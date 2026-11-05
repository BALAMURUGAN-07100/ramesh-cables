import os

# Automatically bind to 0.0.0.0 on Render's dynamic PORT
port = os.environ.get('PORT', '5000')
bind = f"0.0.0.0:{port}"
workers = 1
threads = 4
timeout = 120
accesslog = '-'
errorlog = '-'
