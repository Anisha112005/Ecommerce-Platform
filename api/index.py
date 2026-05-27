import sys
import os

# Add root and backend directories to path so imports work correctly
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root_dir)
sys.path.insert(0, os.path.join(root_dir, "backend"))

# Set working directory to root so any local relative file logic behaves correctly
os.chdir(root_dir)

# Import the Flask application
from backend.app import app
