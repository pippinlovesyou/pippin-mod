# Pippin-Mod

Pippin-Mod is an advanced AI-powered moderation platform designed for Discord communities. It provides intelligent, context-aware moderation tools to help server administrators manage their communities efficiently. 

This project, hosted at [github.com/pippinlovesyou/pippin-mod](https://github.com/pippinlovesyou/pippin-mod), incorporates detailed warning and rule systems, automated moderation processes, and integrations with Discord and OpenAI.

## Features

### Rule-Based Warning System
- Configure rules with different severity levels:
  - **Yellow** (Minor offenses like mild profanity or off-topic discussion)
  - **Orange** (Moderate offenses such as personal attacks or harassment)
  - **Red** (Severe offenses like explicit NSFW content or hate speech)
- Assign customizable point values for violations and automated punishments based on accumulated points.

### Moderation History
- View user-specific histories, including:
  - Total warnings, ignored warnings, and active warnings.
  - Detailed logs of specific offenses categorized by severity.
  - Options to recalculate points and manage ignored warnings.

### Integration with Discord and OpenAI
- **Discord Integration:** Automatically monitor and moderate server activity using custom rules.
- **OpenAI Integration:** Leverage AI for advanced content analysis and moderation decisions.

### Admin Dashboard
- Intuitive UI for configuring rules, monitoring violations, and managing integrations.
- Generate formatted rules text for Discord servers using the built-in rules generator.

### Automated Punishment System
- Define automated actions based on warning points:
  - Temporary mutes (e.g., 60 hours or 1440 hours).
  - Permanent bans for severe or repeated violations.

### Security
- Environment variables or Replit secrets used for storing sensitive credentials securely.
- Ensure safe and clean configuration without exposing private information.

## Getting Started

### Using Replit
For Replit-specific setup instructions, see [REPLIT_README.md](REPLIT_README.md)

### Using GitHub
#### Prerequisites
- Node.js (v18 or higher)

#### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/pippinlovesyou/pippin-mod.git
   ```
2. Navigate to the project directory:
   ```bash
   cd pippin-mod
   ```
3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```
4. Set up the following variables in the `.env` file, or store them securely in Replit secrets if using Replit:
   ```
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_secure_password
   ```

### Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. Access the admin dashboard at your Repl or server URL.

### First Login

1. Open the admin dashboard in your browser.
2. Log in using the admin credentials from the `.env` file or Replit secrets.
3. Configure Discord and OpenAI integrations through the dashboard settings.

## Usage

### Setting Rules
- Navigate to the "Rules" tab in the dashboard.
- Add or edit warning levels, rules, and point values as needed.

### Monitoring Warnings
- View real-time moderation logs and warning histories in the "History" tab.
- Manage ignored warnings and recalculated points.

### Integration Management
- Connect and configure Discord and OpenAI integrations in the "Settings" tab.
- Generate Discord server rules directly from the dashboard.

## Deployment

1. Use Replit's Deployment feature by clicking the "Deploy" button
2. Configure the following:
   - Build Command: `npm run build`
   - Run Command: `npm start`
   - Port: 5000
3. Deploy your application

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
