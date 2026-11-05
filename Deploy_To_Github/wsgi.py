import sys
import os

# Add application directory to path
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from app import app as application

if __name__ == "__main__":
    application.run()
