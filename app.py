import sys
import os

# Ensure the app directory is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import socket
import csv
import io
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, render_template, request, jsonify, Response, session
from flask_cors import CORS
import database

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = 'ramesh-cables-network-super-secure-key-2026'
app.permanent_session_lifetime = timedelta(days=30)
CORS(app)

# Ensure database is initialized with migrations
database.init_db()

def get_local_ip():
    """Detect local Wi-Fi / LAN IP so the father can connect his phone."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentication required. Please enter Security PIN.', 'authenticated': False}), 401
        return f(*args, **kwargs)
    return decorated_function

# AUTHENTICATION ROUTES
@app.route('/api/auth/status', methods=['GET'])
def api_auth_status():
    return jsonify({
        'authenticated': 'user' in session,
        'user': session.get('user', None)
    })

@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    data = request.json or {}
    pin = data.get('pin', '').strip()
    password = data.get('password', '').strip()
    username = data.get('username', 'ramesh').strip()
    remember = data.get('remember', True)

    val = pin if pin else password
    if not val:
        return jsonify({'success': False, 'error': 'Please enter Security PIN or Password'}), 400

    success, msg = database.verify_credentials(val, username=username)
    if success:
        session['user'] = 'Ramesh'
        if remember:
            session.permanent = True
        return jsonify({'success': True, 'message': 'Security check passed!', 'user': 'Ramesh'})
    else:
        return jsonify({'success': False, 'error': 'Incorrect Security PIN or Password!'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out securely'})

@app.route('/api/auth/change-security', methods=['POST'])
@login_required
def api_auth_change_security():
    data = request.json or {}
    new_pin = data.get('new_pin', '').strip()
    new_pass = data.get('new_password', '').strip()
    
    if not new_pin and not new_pass:
        return jsonify({'error': 'Please provide a new 4-digit PIN or password'}), 400

    success = database.update_security_settings(new_pin=new_pin, new_password=new_pass)
    if success:
        return jsonify({'success': True, 'message': 'Security PIN / Password updated successfully!'})
    return jsonify({'error': 'PIN must be at least 4 digits'}), 400

# WEB APPLICATION ENTRY
@app.route('/')
def index():
    local_ip = get_local_ip()
    settings = database.get_all_settings()
    now = datetime.now()
    current_month = now.strftime('%Y-%m')
    current_month_name = now.strftime('%B %Y')
    is_authenticated = 'user' in session
    return render_template('index.html', 
                           local_ip=local_ip, 
                           settings=settings, 
                           current_month=current_month, 
                           current_month_name=current_month_name,
                           is_authenticated=is_authenticated)

# BUSINESS APIS
@app.route('/api/stats', methods=['GET'])
@login_required
def api_stats():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    stats = database.get_stats(month)
    return jsonify(stats)

@app.route('/api/customers', methods=['GET'])
@login_required
def api_customers():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    operator = request.args.get('operator', 'all')
    status = request.args.get('status', 'all')
    search = request.args.get('search', '')
    street = request.args.get('street', '')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    offset = (page - 1) * limit

    customers, total = database.get_customers(
        month=month,
        operator=operator,
        status=status,
        search=search,
        street=street,
        limit=limit,
        offset=offset
    )

    return jsonify({
        'customers': customers,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit if total > 0 else 1
    })

@app.route('/api/customers/<int:customer_id>', methods=['GET'])
@login_required
def api_customer_detail(customer_id):
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    cust = database.get_customer_details(customer_id, current_month=month)
    if not cust:
        return jsonify({'error': 'Customer not found'}), 404
    return jsonify(cust)

@app.route('/api/customers', methods=['POST'])
@login_required
def api_add_customer():
    data = request.json or {}
    box_number = data.get('box_number', '').strip()
    secondary_box_number = data.get('secondary_box_number', '').strip()
    smart_card_number = data.get('smart_card_number', '').strip()
    customer_name = data.get('customer_name', '').strip()
    operator = data.get('operator', 'SCV').strip().upper()
    try:
        monthly_fee = float(data.get('monthly_fee', 250))
    except (ValueError, TypeError):
        monthly_fee = 250.0

    if not box_number or not customer_name:
        return jsonify({'error': 'Box number and customer name are required'}), 400

    try:
        new_id = database.add_customer(
            box_number=box_number,
            customer_name=customer_name,
            operator=operator,
            monthly_fee=monthly_fee,
            phone=data.get('phone', ''),
            door_no=data.get('door_no', ''),
            street=data.get('street', ''),
            area=data.get('area', ''),
            barcode=data.get('barcode', box_number),
            plan_details=data.get('plan_details', ''),
            secondary_box_number=secondary_box_number,
            smart_card_number=smart_card_number
        )
        return jsonify({'success': True, 'id': new_id, 'message': 'Customer added successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/customers/<int:customer_id>', methods=['PUT'])
@login_required
def api_update_customer(customer_id):
    data = request.json or {}
    success = database.update_customer(customer_id, **data)
    if not success:
        return jsonify({'error': 'Customer not found or invalid data'}), 400
    return jsonify({'success': True, 'message': 'Customer updated successfully'})

@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
@login_required
def api_delete_customer(customer_id):
    success = database.delete_customer(customer_id)
    if not success:
        return jsonify({'error': 'Customer not found'}), 404
    return jsonify({'success': True, 'message': 'Customer deleted successfully'})

@app.route('/api/stb/lookup', methods=['GET'])
@login_required
def api_lookup_stb():
    code = request.args.get('code', '').strip()
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    if not code:
        return jsonify({'error': 'No code provided'}), 400

    cust = database.find_customer_by_code(code)
    if not cust:
        return jsonify({'found': False, 'message': f'No Set-Top Box found with number/barcode: "{code}"'}), 404

    cust_full = database.get_customer_details(cust['id'], current_month=month)
    return jsonify({'found': True, 'customer': cust_full})

@app.route('/api/payments', methods=['POST'])
@login_required
def api_record_payment():
    data = request.json or {}
    customer_id = data.get('customer_id')
    month = data.get('month', datetime.now().strftime('%Y-%m'))
    try:
        amount = float(data.get('amount', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400

    if not customer_id or amount <= 0:
        return jsonify({'error': 'Valid Customer ID and amount > 0 are required'}), 400

    payment_mode = data.get('payment_mode', 'Cash')
    remarks = data.get('remarks', '')
    transaction_ref = data.get('transaction_ref', '')
    collected_by = data.get('collected_by', 'Ramesh')

    receipt = database.add_or_update_payment(
        customer_id=customer_id,
        month=month,
        amount=amount,
        payment_mode=payment_mode,
        remarks=remarks,
        transaction_ref=transaction_ref,
        collected_by=collected_by
    )

    settings = database.get_all_settings()
    return jsonify({
        'success': True,
        'message': f'Payment of ₹{amount:g} recorded successfully!',
        'receipt': receipt,
        'settings': settings
    })

@app.route('/api/payments/<int:payment_id>', methods=['DELETE'])
@login_required
def api_delete_payment(payment_id):
    success = database.delete_payment(payment_id)
    if not success:
        return jsonify({'error': 'Payment record not found'}), 404
    return jsonify({'success': True, 'message': 'Payment record removed successfully'})

@app.route('/api/streets', methods=['GET'])
@login_required
def api_streets():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    streets = database.get_all_streets(month=month)
    return jsonify(streets)

@app.route('/api/streets/<int:street_number>', methods=['PUT'])
@login_required
def api_update_street(street_number):
    data = request.json or {}
    street_name = data.get('street_name', '').strip()
    coverage = data.get('operator_coverage', None)
    if not street_name:
        return jsonify({'error': 'Street name is required'}), 400

    success, msg = database.update_street(street_number, street_name, coverage)
    if success:
        return jsonify({'success': True, 'message': msg})
    return jsonify({'error': msg}), 400

@app.route('/api/wipe-demo', methods=['POST'])
@login_required
def api_wipe_demo():
    database.wipe_all_demo_data()
    return jsonify({'success': True, 'message': 'All demo records removed. Ready for your father to add real customers!'})

@app.route('/api/settings', methods=['GET'])
@login_required
def api_get_settings():
    return jsonify(database.get_all_settings())

@app.route('/api/settings', methods=['POST'])
@login_required
def api_save_settings():
    data = request.json or {}
    database.update_settings(data)
    return jsonify({'success': True, 'message': 'Settings saved successfully', 'settings': database.get_all_settings()})

@app.route('/api/reset-data', methods=['POST'])
@login_required
def api_reset_data():
    data = request.json or {}
    force_seed = data.get('seed_demo', True)
    if force_seed:
        success, msg = database.seed_sample_data(force=True)
        return jsonify({'success': success, 'message': msg})
    else:
        conn = database.get_connection()
        conn.execute('DELETE FROM payments')
        conn.execute('DELETE FROM customers')
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Database cleared completely'})

@app.route('/api/export-csv', methods=['GET'])
@login_required
def api_export_csv():
    month = request.args.get('month', datetime.now().strftime('%Y-%m'))
    customers, _ = database.get_customers(month=month, limit=10000, offset=0)
    
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    
    writer.writerow([
        'Box Number', 'Another Box No', 'Smart Card', 'Customer Name', 'Phone', 'Door No', 
        'Street', 'Area', 'Operator', 'Monthly Fee (Rs)', 'Month', 
        'Amount Paid (Rs)', 'Due (Rs)', 'Payment Status', 'Last Payment Date', 'Payment Mode'
    ])
    
    for c in customers:
        writer.writerow([
            c['box_number'],
            c.get('secondary_box_number') or '',
            c.get('smart_card_number') or '',
            c['customer_name'],
            c['phone'],
            c['door_no'],
            c['street'],
            c['area'],
            c['operator'],
            c['monthly_fee'],
            month,
            c['paid_amount'],
            c['due_amount'],
            c['status_code'],
            c['last_payment_date'] or 'N/A',
            c['last_payment_mode'] or 'N/A'
        ])

    csv_data = output.getvalue()
    return Response(
        csv_data.encode('utf-8'),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment;filename=RameshCables_Report_{month}.csv"}
    )

@app.route('/api/import-csv', methods=['POST'])
@login_required
def api_import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Please upload a .csv file'}), 400

    try:
        stream = io.StringIO(file.stream.read().decode('utf-8-sig', errors='ignore'))
        reader = csv.DictReader(stream)
        imported_count = 0

        for row in reader:
            box_no = row.get('Box Number') or row.get('box_number') or row.get('STB Number') or row.get('STB') or row.get('Box No')
            sec_box = row.get('Another Box No') or row.get('Secondary Box No') or row.get('secondary_box_number') or ''
            smart_card = row.get('Smart Card') or row.get('smart_card_number') or ''
            cust_name = row.get('Customer Name') or row.get('customer_name') or row.get('Name') or 'Unknown'
            operator = row.get('Operator') or row.get('operator') or 'SCV'
            monthly_fee = float(row.get('Monthly Fee') or row.get('monthly_fee') or row.get('Monthly Fee (Rs)') or 250)
            phone = row.get('Phone') or row.get('phone') or row.get('Mobile') or ''
            door_no = row.get('Door No') or row.get('door_no') or row.get('Door') or ''
            street = row.get('Street') or row.get('street') or ''
            area = row.get('Area') or row.get('area') or ''

            if box_no and cust_name:
                try:
                    database.add_customer(
                        box_number=box_no.strip(),
                        customer_name=cust_name.strip(),
                        operator=operator.strip().upper(),
                        monthly_fee=monthly_fee,
                        phone=phone.strip(),
                        door_no=door_no.strip(),
                        street=street.strip(),
                        area=area.strip(),
                        barcode=box_no.strip(),
                        secondary_box_number=sec_box.strip(),
                        smart_card_number=smart_card.strip()
                    )
                    imported_count += 1
                except Exception:
                    existing = database.find_customer_by_code(box_no.strip())
                    if existing:
                        database.update_customer(
                            existing['id'],
                            customer_name=cust_name.strip(),
                            operator=operator.strip().upper(),
                            monthly_fee=monthly_fee,
                            phone=phone.strip(),
                            door_no=door_no.strip(),
                            street=street.strip(),
                            area=area.strip(),
                            secondary_box_number=sec_box.strip(),
                            smart_card_number=smart_card.strip()
                        )
                        imported_count += 1

        return jsonify({'success': True, 'message': f'Successfully imported/updated {imported_count} customer houses!'})
    except Exception as e:
        return jsonify({'error': f'Import error: {str(e)}'}), 400

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 5000
    print("=" * 60)
    print("  RAMESH CABLES AND NET WORK - Management System")
    print("=" * 60)
    print(f"  * Desktop Access : http://localhost:{port}")
    print(f"  * Mobile Access  : http://{local_ip}:{port}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=True)
