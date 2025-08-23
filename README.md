# Webex Authentication CLI Tool

A command-line tool to authenticate with Webex APIs using OAuth 2.0 and store access tokens in environment variables.

## Features

- OAuth 2.0 authentication flow with Webex
- Automatic browser opening for authentication
- Token storage in `.env` file
- Token information display
- Support for custom scopes and redirect URIs

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Optionally, install globally:
   ```bash
   npm install -g .
   ```

## Prerequisites

Before using this tool, you need to:

1. Create a Webex application at [https://developer.webex.com/](https://developer.webex.com/)
2. Note down your Client ID and Client Secret
3. Configure the redirect URI in your Webex app (the tool will use a localhost callback)

## Usage

### Authentication

To authenticate and store a token:

```bash
# Using the built version
node dist/webex-auth.js login -i YOUR_CLIENT_ID -s YOUR_CLIENT_SECRET

# Or if installed globally
webex-auth login -i YOUR_CLIENT_ID -s YOUR_CLIENT_SECRET

# With custom scope
webex-auth login -i YOUR_CLIENT_ID -s YOUR_CLIENT_SECRET --scope "spark:people_read spark:rooms_read"
```

The tool will:
1. Start a local HTTP server for the OAuth callback
2. Open your default browser to the Webex authorization page
3. Handle the callback and exchange the authorization code for tokens
4. Store the tokens in your home directory (`~/.webex-cli/`)

### Token Information

To view stored token information:

```bash
webex-auth info
```

### Using the Token

After authentication, you can use the token in several ways:

#### Method 1: Source the shell script (Recommended)
```bash
source ~/.webex-cli/webex-env.sh
echo $WEBEX_ACCESS_TOKEN
```

#### Method 2: Add to your shell profile for automatic loading
Add this line to your `~/.bashrc`, `~/.zshrc`, or equivalent:
```bash
source ~/.webex-cli/webex-env.sh
```

#### Method 3: Manual export
```bash
export WEBEX_ACCESS_TOKEN="your_token_here"
```

#### Token Storage
The tokens are stored in `~/.webex-cli/` directory as:
- `.env` - Environment file format
- `webex-env.sh` - Shell script for easy sourcing

Environment variables set:
- `WEBEX_ACCESS_TOKEN` - The access token
- `WEBEX_REFRESH_TOKEN` - The refresh token (for future use)
- `WEBEX_TOKEN_EXPIRES_AT` - Token expiration timestamp

## API Usage Example

Once you have the token, you can make API calls to Webex:

```bash
# Get current user information
curl -H "Authorization: Bearer $WEBEX_ACCESS_TOKEN" \
     "https://webexapis.com/v1/people/me"

# List rooms
curl -H "Authorization: Bearer $WEBEX_ACCESS_TOKEN" \
     "https://webexapis.com/v1/rooms"
```

## Command Options

### `login` command
- `-i, --client-id <id>` - **Required**: Your Webex application client ID
- `-s, --client-secret <secret>` - **Required**: Your Webex application client secret  
- `--scope <scope>` - OAuth scope (default: "spark:all")
- `--redirect-uri <uri>` - OAuth redirect URI (default uses localhost callback)

### `info` command
- No options - displays information about stored tokens

## Development

### Running in development mode
```bash
npm run dev -- login -i YOUR_CLIENT_ID -s YOUR_CLIENT_SECRET
```

### Building
```bash
npm run build
```

## Security Notes

- Keep your client secret secure and never commit it to version control
- The tokens are stored in your home directory (`~/.webex-cli/`) with restricted permissions
- Tokens have expiration times - use the `info` command to check expiration
- In production applications, implement proper token refresh logic

## Troubleshooting

### Browser doesn't open automatically
If the browser doesn't open automatically, the tool will display the authorization URL. Copy and paste it into your browser manually.

### Port already in use
The tool automatically finds an available port for the callback server.

### Token expired
Run the `info` command to check token expiration, then re-authenticate with `login` if needed.

### Tokens not loading in new terminal session
Make sure to run `source ~/.webex-cli/webex-env.sh` in each new terminal session, or add it to your shell profile for automatic loading.

## License

ISC