import sqlite3
import os
import random
from datetime import datetime

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, 'ramesh_cables.db')

def get_connection():
    db_dir = os.path.dirname(os.path.abspath(DB_PATH))
    if not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Settings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')

    # Customers table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        box_number TEXT UNIQUE NOT NULL,
        secondary_box_number TEXT,
        smart_card_number TEXT,
        barcode TEXT,
        customer_name TEXT NOT NULL,
        phone TEXT,
        door_no TEXT,
        street TEXT,
        area TEXT,
        operator TEXT NOT NULL, -- 'SCV' or 'TACTV'
        monthly_fee REAL NOT NULL DEFAULT 250,
        plan_details TEXT DEFAULT 'Standard Digital Package',
        status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Safe migration: ensure new columns exist in existing database
    cursor.execute("PRAGMA table_info(customers)")
    cols = [col[1] for col in cursor.fetchall()]
    if 'secondary_box_number' not in cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN secondary_box_number TEXT")
    if 'smart_card_number' not in cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN smart_card_number TEXT")

    # Payments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        month TEXT NOT NULL, -- Format: YYYY-MM (e.g. '2026-11')
        amount_paid REAL NOT NULL,
        payment_mode TEXT NOT NULL DEFAULT 'Cash', -- 'Cash', 'GPay', 'PhonePe', 'Paytm', 'UPI', 'Other'
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        transaction_ref TEXT,
        remarks TEXT,
        collected_by TEXT DEFAULT 'Ramesh',
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
    ''')

    # Streets table (Streets 1 to 15)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS streets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        street_number INTEGER UNIQUE NOT NULL,
        street_name TEXT NOT NULL,
        operator_coverage TEXT DEFAULT 'BOTH', -- 'BOTH', 'TACTV', 'SCV'
        notes TEXT
    )
    ''')

    # Initialize Streets 1 to 15 if not already present
    cursor.execute('SELECT COUNT(*) as cnt FROM streets')
    if cursor.fetchone()['cnt'] == 0:
        for i in range(1, 16):
            # Streets 1 to 5 cover both TACTV & SCV; Streets 6 to 15 cover SCV (or editable)
            coverage = 'BOTH' if i <= 5 else 'SCV'
            cursor.execute('''
            INSERT INTO streets (street_number, street_name, operator_coverage)
            VALUES (?, ?, ?)
            ''', (i, f"Street {i}", coverage))

    # Initialize default settings if not exists
    default_settings = [
        ('business_name', 'RAMESH CABLES AND NET WORK'),
        ('tagline', 'Professional Cable TV & Network Services'),
        ('owner_name', 'Ramesh'),
        ('contact_phone', '9842100000'),
        ('upi_id', 'rameshcables@okaxis'),
        ('scv_default_fee', '250'),
        ('tactv_default_fee', '150'),
        ('address', '12, Main Bazaar Street, Tamil Nadu'),
        ('receipt_notes', 'Thank you for your timely payment! Keep receipt safe.'),
        ('security_pin', '1234'),
        ('admin_username', 'ramesh'),
        ('admin_password', 'ramesh123')
    ]

    for key, val in default_settings:
        cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (key, val))

    conn.commit()
    conn.close()

def get_all_settings():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT key, value FROM settings')
    rows = cursor.fetchall()
    conn.close()
    return {row['key']: row['value'] for row in rows}

def update_settings(settings_dict):
    conn = get_connection()
    cursor = conn.cursor()
    for k, v in settings_dict.items():
        cursor.execute('''
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ''', (k, str(v)))
    conn.commit()
    conn.close()

def seed_sample_data(force=False):
    """Seed 350 SCV and 150 TACTV sample houses for realistic testing."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as cnt FROM customers')
    count = cursor.fetchone()['cnt']
    if count > 0 and not force:
        conn.close()
        return False, "Data already exists"

    if force:
        cursor.execute('DELETE FROM payments')
        cursor.execute('DELETE FROM customers')

    streets = [
        "Gandhi Road", "Anna Salai", "Kamarajar Street", "Bazaar Street",
        "Pillayar Kovil Street", "North Car Street", "South Car Street",
        "MGR Nagar", "Barathiyar Street", "Post Office Road", "Station Road",
        "Nehru Street", "Mariamman Kovil St", "Periyar Street"
    ]

    first_names = [
        "Murugan", "Senthil", "Karthik", "Ravi", "Muthu", "Kumar", "Selvam",
        "Saravanan", "Prakash", "Ganesh", "Vijay", "Anand", "Venkatesh",
        "Subramaniam", "Kannan", "Balaji", "Ramasamy", "Suresh", "Manikandan",
        "Thangaraj", "Rajesh", "Govindaraj", "Dhanapal", "Pandian", "Elangovan",
        "Lakshmi", "Meena", "Vasanthi", "Radha", "Kavitha", "Revathi", "Shanthi"
    ]
    last_names = ["Kumar", "Nathan", "Rao", "Pillai", "Chettiar", "Thevar", "Gounder", "Mudaliar", ""]

    settings = get_all_settings()
    scv_fee = float(settings.get('scv_default_fee', 250))
    tactv_fee = float(settings.get('tactv_default_fee', 150))

    # Seed 350 SCV
    for i in range(1, 351):
        box_num = f"SCV-{1000 + i}"
        barcode = box_num
        name = f"{random.choice(first_names)} {random.choice(last_names)}".strip()
        street = random.choice(streets)
        door_no = f"{random.randint(1, 150)}/{random.choice(['A', 'B', '1', '2', ''])}".rstrip('/')
        phone = f"98{random.randint(10000000, 99999999)}"
        plan = "SCV Digital Standard" if i % 2 == 0 else "SCV HD Gold"

        cursor.execute('''
        INSERT INTO customers (box_number, barcode, customer_name, phone, door_no, street, area, operator, monthly_fee, plan_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'SCV', ?, ?)
        ''', (box_num, barcode, name, phone, door_no, street, "Town Area", scv_fee, plan))

    # Seed 150 TACTV
    for i in range(1, 151):
        box_num = f"TAC-{2000 + i}"
        barcode = box_num
        name = f"{random.choice(first_names)} {random.choice(last_names)}".strip()
        street = random.choice(streets)
        door_no = f"{random.randint(1, 120)}/{random.choice(['A', 'C', ''])}".rstrip('/')
        phone = f"97{random.randint(10000000, 99999999)}"
        plan = "TACTV Arasu Standard"

        cursor.execute('''
        INSERT INTO customers (box_number, barcode, customer_name, phone, door_no, street, area, operator, monthly_fee, plan_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'TACTV', ?, ?)
        ''', (box_num, barcode, name, phone, door_no, street, "Rural/Town", tactv_fee, plan))

    # Add realistic sample payments for current month (November 2026) and previous month (October 2026)
    conn.commit()

    cursor.execute('SELECT id, operator, monthly_fee FROM customers')
    cust_rows = cursor.fetchall()
    
    now = datetime.now()
    cur_month = now.strftime('%Y-%m')
    modes = ['Cash', 'Cash', 'GPay', 'PhonePe', 'Paytm', 'Cash']

    # For current month, simulate ~65% paid, 5% partial, 30% unpaid
    for cust in cust_rows:
        cid = cust['id']
        fee = cust['monthly_fee']
        rand_val = random.random()

        if rand_val < 0.65:
            # Fully paid
            p_date = f"{cur_month}-{random.randint(1, min(28, now.day if now.day > 1 else 3)):02d} {random.randint(8, 20):02d}:{random.randint(10, 59):02d}:00"
            mode = random.choice(modes)
            ref = f"UPI{random.randint(100000, 999999)}" if mode in ['GPay', 'PhonePe', 'Paytm'] else ""
            cursor.execute('''
            INSERT INTO payments (customer_id, month, amount_paid, payment_mode, payment_date, transaction_ref, remarks, collected_by)
            VALUES (?, ?, ?, ?, ?, ?, 'Monthly Bill Paid', 'Ramesh')
            ''', (cid, cur_month, fee, mode, p_date, ref))
        elif rand_val < 0.70:
            # Partial paid
            part_amt = 100.0 if fee > 100 else 50.0
            p_date = f"{cur_month}-02 11:30:00"
            cursor.execute('''
            INSERT INTO payments (customer_id, month, amount_paid, payment_mode, payment_date, remarks, collected_by)
            VALUES (?, ?, ?, 'Cash', ?, 'Advance partial payment', 'Ramesh')
            ''', (cid, cur_month, part_amt, p_date))
        # else unpaid

    conn.commit()
    conn.close()
    return True, "Seeded 350 SCV and 150 TACTV sample records successfully"

def get_stats(month):
    """Calculate dashboard summary for a specific month (YYYY-MM)."""
    conn = get_connection()
    cursor = conn.cursor()

    # Total customers breakdown
    cursor.execute('''
    SELECT 
        COUNT(*) as total_customers,
        SUM(CASE WHEN operator = 'SCV' THEN 1 ELSE 0 END) as scv_total,
        SUM(CASE WHEN operator = 'TACTV' THEN 1 ELSE 0 END) as tactv_total,
        SUM(monthly_fee) as expected_revenue,
        SUM(CASE WHEN operator = 'SCV' THEN monthly_fee ELSE 0 END) as scv_expected,
        SUM(CASE WHEN operator = 'TACTV' THEN monthly_fee ELSE 0 END) as tactv_expected
    FROM customers
    WHERE status = 'ACTIVE'
    ''')
    cust_stats = cursor.fetchone()

    total_customers = cust_stats['total_customers'] or 0
    scv_total = cust_stats['scv_total'] or 0
    tactv_total = cust_stats['tactv_total'] or 0
    expected_revenue = cust_stats['expected_revenue'] or 0
    scv_expected = cust_stats['scv_expected'] or 0
    tactv_expected = cust_stats['tactv_expected'] or 0

    # Payments summary for the given month
    cursor.execute('''
    SELECT 
        c.operator,
        c.id as customer_id,
        c.monthly_fee,
        COALESCE(SUM(p.amount_paid), 0) as paid_amount
    FROM customers c
    LEFT JOIN payments p ON c.id = p.customer_id AND p.month = ?
    WHERE c.status = 'ACTIVE'
    GROUP BY c.id
    ''', (month,))
    
    rows = cursor.fetchall()
    
    total_collected = 0.0
    paid_count = 0
    partial_count = 0
    unpaid_count = 0

    scv_collected = 0.0
    scv_paid_count = 0
    scv_unpaid_count = 0

    tactv_collected = 0.0
    tactv_paid_count = 0
    tactv_unpaid_count = 0

    for r in rows:
        paid = float(r['paid_amount'])
        fee = float(r['monthly_fee'])
        op = r['operator']

        total_collected += paid
        if op == 'SCV':
            scv_collected += paid
        else:
            tactv_collected += paid

        if paid >= fee and fee > 0:
            paid_count += 1
            if op == 'SCV':
                scv_paid_count += 1
            else:
                tactv_paid_count += 1
        elif paid > 0:
            partial_count += 1
        else:
            unpaid_count += 1
            if op == 'SCV':
                scv_unpaid_count += 1
            else:
                tactv_unpaid_count += 1

    pending_amount = max(0.0, expected_revenue - total_collected)
    scv_pending = max(0.0, scv_expected - scv_collected)
    tactv_pending = max(0.0, tactv_expected - tactv_collected)

    # Payment modes breakdown for this month
    cursor.execute('''
    SELECT payment_mode, SUM(amount_paid) as total, COUNT(*) as count
    FROM payments
    WHERE month = ?
    GROUP BY payment_mode
    ''', (month,))
    mode_rows = cursor.fetchall()
    modes_breakdown = {row['payment_mode']: {'total': float(row['total']), 'count': row['count']} for row in mode_rows}

    conn.close()

    return {
        'month': month,
        'total_customers': total_customers,
        'expected_revenue': expected_revenue,
        'total_collected': total_collected,
        'pending_amount': pending_amount,
        'collection_percentage': round((total_collected / expected_revenue * 100), 1) if expected_revenue > 0 else 0,
        'paid_count': paid_count,
        'partial_count': partial_count,
        'unpaid_count': unpaid_count,
        'scv': {
            'total': scv_total,
            'expected': scv_expected,
            'collected': scv_collected,
            'pending': scv_pending,
            'paid_count': scv_paid_count,
            'unpaid_count': scv_unpaid_count
        },
        'tactv': {
            'total': tactv_total,
            'expected': tactv_expected,
            'collected': tactv_collected,
            'pending': tactv_pending,
            'paid_count': tactv_paid_count,
            'unpaid_count': tactv_unpaid_count
        },
        'payment_modes': modes_breakdown
    }

def get_customers(month, operator='all', status='all', search='', street='', limit=100, offset=0):
    """Retrieve customers with their monthly status."""
    conn = get_connection()
    cursor = conn.cursor()

    query = '''
    SELECT 
        c.*,
        COALESCE(SUM(p.amount_paid), 0) as paid_amount,
        MAX(p.payment_date) as last_payment_date,
        MAX(p.payment_mode) as last_payment_mode,
        MAX(p.id) as last_payment_id
    FROM customers c
    LEFT JOIN payments p ON c.id = p.customer_id AND p.month = ?
    WHERE 1=1
    '''
    params = [month]

    if operator and operator.upper() in ['SCV', 'TACTV']:
        query += " AND c.operator = ?"
        params.append(operator.upper())

    if street:
        query += " AND c.street = ?"
        params.append(street)

    if search:
        search_like = f"%{search.strip()}%"
        query += ''' AND (
            c.box_number LIKE ? OR 
            c.secondary_box_number LIKE ? OR
            c.barcode LIKE ? OR 
            c.smart_card_number LIKE ? OR
            c.customer_name LIKE ? OR 
            c.phone LIKE ? OR 
            c.door_no LIKE ? OR 
            c.street LIKE ?
        )'''
        params.extend([search_like] * 8)

    query += " GROUP BY c.id"

    # Status filtering having condition
    if status == 'paid':
        query += " HAVING paid_amount >= c.monthly_fee AND c.monthly_fee > 0"
    elif status == 'unpaid':
        query += " HAVING paid_amount = 0"
    elif status == 'partial':
        query += " HAVING paid_amount > 0 AND paid_amount < c.monthly_fee"

    # Sorting
    query += " ORDER BY c.operator ASC, c.box_number ASC"

    # Get total count first
    count_query = f"SELECT COUNT(*) as total_found FROM ({query})"
    cursor.execute(count_query, params)
    total_found = cursor.fetchone()['total_found']

    # Apply pagination
    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        d = dict(r)
        fee = float(d['monthly_fee'])
        paid = float(d['paid_amount'])
        due = max(0.0, fee - paid)
        
        if paid >= fee and fee > 0:
            status_code = 'PAID'
            status_label = 'Paid'
            badge_class = 'badge-paid'
        elif paid > 0:
            status_code = 'PARTIAL'
            status_label = f'Partial (₹{paid:g}/₹{fee:g})'
            badge_class = 'badge-partial'
        else:
            status_code = 'UNPAID'
            status_label = 'Not Paid'
            badge_class = 'badge-unpaid'

        d['status_code'] = status_code
        d['status_label'] = status_label
        d['badge_class'] = badge_class
        d['due_amount'] = due
        result.append(d)

    return result, total_found

def find_customer_by_code(code):
    """Find customer by primary STB number, secondary box number, barcode, or phone."""
    conn = get_connection()
    cursor = conn.cursor()
    code_clean = code.strip()
    
    # Exact match first across all identifiers
    cursor.execute('''
    SELECT * FROM customers 
    WHERE box_number = ? OR secondary_box_number = ? OR barcode = ? OR smart_card_number = ? OR phone = ?
    LIMIT 1
    ''', (code_clean, code_clean, code_clean, code_clean, code_clean))
    row = cursor.fetchone()

    # Fallback to case-insensitive
    if not row:
        cursor.execute('''
        SELECT * FROM customers 
        WHERE LOWER(box_number) = LOWER(?) OR LOWER(secondary_box_number) = LOWER(?) OR LOWER(barcode) = LOWER(?) OR LOWER(smart_card_number) = LOWER(?)
        LIMIT 1
        ''', (code_clean, code_clean, code_clean, code_clean))
        row = cursor.fetchone()

    conn.close()
    return dict(row) if row else None

def get_customer_details(customer_id, current_month=None):
    """Get customer profile along with their full payment history."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM customers WHERE id = ?', (customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        return None

    cust_dict = dict(cust)

    # Get payments history
    cursor.execute('''
    SELECT * FROM payments 
    WHERE customer_id = ?
    ORDER BY month DESC, payment_date DESC
    ''', (customer_id,))
    payments = [dict(p) for p in cursor.fetchall()]

    # If current month specified, check current month status
    if current_month:
        month_paid = sum(p['amount_paid'] for p in payments if p['month'] == current_month)
        fee = cust_dict['monthly_fee']
        cust_dict['current_month_paid'] = month_paid
        cust_dict['current_month_due'] = max(0.0, fee - month_paid)
        if month_paid >= fee and fee > 0:
            cust_dict['current_month_status'] = 'PAID'
        elif month_paid > 0:
            cust_dict['current_month_status'] = 'PARTIAL'
        else:
            cust_dict['current_month_status'] = 'UNPAID'

    cust_dict['payments'] = payments
    conn.close()
    return cust_dict

def add_or_update_payment(customer_id, month, amount, payment_mode='Cash', remarks='', transaction_ref='', collected_by='Ramesh'):
    """Record a payment for a customer for a specific month."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
    INSERT INTO payments (customer_id, month, amount_paid, payment_mode, remarks, transaction_ref, collected_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (customer_id, month, amount, payment_mode, remarks, transaction_ref, collected_by))

    payment_id = cursor.lastrowid
    conn.commit()

    # Fetch created payment details with customer name for receipt
    cursor.execute('''
    SELECT p.*, c.customer_name, c.box_number, c.door_no, c.street, c.operator, c.phone, c.monthly_fee
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.id = ?
    ''', (payment_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None

def delete_payment(payment_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM payments WHERE id = ?', (payment_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def add_customer(box_number, customer_name, operator, monthly_fee, phone='', door_no='', street='', area='', barcode=None, plan_details='', secondary_box_number='', smart_card_number=''):
    conn = get_connection()
    cursor = conn.cursor()
    if not barcode:
        barcode = box_number

    cursor.execute('''
    INSERT INTO customers (box_number, secondary_box_number, smart_card_number, barcode, customer_name, phone, door_no, street, area, operator, monthly_fee, plan_details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (box_number.strip(), secondary_box_number.strip(), smart_card_number.strip(), barcode.strip(), customer_name.strip(), phone.strip(), door_no.strip(), street.strip(), area.strip(), operator.strip().upper(), monthly_fee, plan_details.strip()))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def update_customer(customer_id, **kwargs):
    conn = get_connection()
    cursor = conn.cursor()
    
    allowed = ['box_number', 'secondary_box_number', 'smart_card_number', 'barcode', 'customer_name', 'phone', 'door_no', 'street', 'area', 'operator', 'monthly_fee', 'plan_details', 'status', 'notes']
    sets = []
    values = []
    
    for k, v in kwargs.items():
        if k in allowed:
            sets.append(f"{k} = ?")
            values.append(v)
            
    if not sets:
        conn.close()
        return False
        
    values.append(customer_id)
    cursor.execute(f"UPDATE customers SET {', '.join(sets)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return True

def verify_credentials(pin_or_password, username=None):
    """Verify security PIN or Username/Password."""
    settings = get_all_settings()
    stored_pin = settings.get('security_pin', '1234')
    stored_user = settings.get('admin_username', 'ramesh')
    stored_pass = settings.get('admin_password', 'ramesh123')
    
    val = str(pin_or_password).strip()
    # Check 4-digit PIN
    if val == stored_pin:
        return True, "PIN verified"
    # Check username & password
    if username and username.strip().lower() == stored_user.lower() and val == stored_pass:
        return True, "Password verified"
    if val == stored_pass:
        return True, "Password verified"
    return False, "Invalid PIN or Password"

def update_security_settings(new_pin=None, new_password=None, new_username=None):
    """Update security PIN and credentials."""
    updates = {}
    if new_pin and len(str(new_pin).strip()) >= 4:
        updates['security_pin'] = str(new_pin).strip()
    if new_password and len(str(new_password).strip()) >= 4:
        updates['admin_password'] = str(new_password).strip()
    if new_username and len(str(new_username).strip()) > 0:
        updates['admin_username'] = str(new_username).strip()
    if updates:
        update_settings(updates)
        return True
    return False

def delete_customer(customer_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM customers WHERE id = ?', (customer_id,))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success

def wipe_all_demo_data():
    """Completely wipe all demo customer houses and demo payment records."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM payments')
    cursor.execute('DELETE FROM customers')
    conn.commit()
    conn.close()
    return True

def get_all_streets(month=None):
    """Retrieve all 15 streets with live customer & payment counts."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if not month:
        month = datetime.now().strftime('%Y-%m')

    cursor.execute('''
    SELECT 
        s.*,
        COUNT(c.id) as total_customers,
        SUM(CASE WHEN c.operator = 'SCV' THEN 1 ELSE 0 END) as scv_count,
        SUM(CASE WHEN c.operator = 'TACTV' THEN 1 ELSE 0 END) as tactv_count,
        SUM(CASE WHEN COALESCE(p.paid_amount, 0) >= c.monthly_fee AND c.id IS NOT NULL THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN COALESCE(p.paid_amount, 0) < c.monthly_fee AND c.id IS NOT NULL THEN 1 ELSE 0 END) as unpaid_count
    FROM streets s
    LEFT JOIN customers c ON (c.street = s.street_name OR c.street = ('Street ' || s.street_number)) AND c.status = 'ACTIVE'
    LEFT JOIN (
        SELECT customer_id, SUM(amount_paid) as paid_amount 
        FROM payments 
        WHERE month = ? 
        GROUP BY customer_id
    ) p ON c.id = p.customer_id
    GROUP BY s.id
    ORDER BY s.street_number ASC
    ''', (month,))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_street(street_number, new_name, coverage=None):
    """Edit street name and coverage, and update existing customer records on that street."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT street_name FROM streets WHERE street_number = ?', (street_number,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False, "Street not found"

    old_name = row['street_name']
    new_name_clean = new_name.strip()

    if coverage:
        cursor.execute('''
        UPDATE streets 
        SET street_name = ?, operator_coverage = ? 
        WHERE street_number = ?
        ''', (new_name_clean, coverage.upper(), street_number))
    else:
        cursor.execute('''
        UPDATE streets 
        SET street_name = ? 
        WHERE street_number = ?
        ''', (new_name_clean, street_number))

    # Update linked customers
    cursor.execute('''
    UPDATE customers 
    SET street = ? 
    WHERE street = ? OR street = ?
    ''', (new_name_clean, old_name, f"Street {street_number}"))

    conn.commit()
    conn.close()
    return True, f"Street {street_number} updated to '{new_name_clean}'"

def get_streets_list():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT street_name FROM streets ORDER BY street_number ASC')
    streets = [row['street_name'] for row in cursor.fetchall()]
    conn.close()
    return streets
    return streets
