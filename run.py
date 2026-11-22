import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '127.0.0.1')  # use HOST=0.0.0.0 to expose on the local network
    app.run(host=host, port=port, debug=app.config['DEBUG'])
