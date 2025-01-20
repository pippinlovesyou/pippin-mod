
# Setting up Pippin-Mod on Replit

## Quick Setup

1. Click the "Import from GitHub" button in Replit
2. Enter: `github.com/pippinlovesyou/pippin-mod`
3. In the Secrets tab, add your environment variables:
   ```
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_secure_password
   ```
4. Click "Run" to start the development server
5. Access the admin dashboard at your Repl URL

## Deployment

1. Click the "Deploy" button in your Repl
2. Configure the deployment:
   - Build Command: `npm run build`
   - Run Command: `npm start`
   - Port: 5000
3. Click "Deploy" to make your app live

## Development

The development server will automatically:
- Install dependencies
- Set up the database
- Start the application on port 5000

Any changes you make will automatically reload the application.
