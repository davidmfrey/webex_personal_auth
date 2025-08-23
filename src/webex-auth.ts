#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

class TokenManager {
  private envFilePath: string;
  private configDir: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.webex-cli');
    this.envFilePath = path.join(this.configDir, '.env');
    
    // Ensure config directory exists
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  async saveToken(token: TokenResponse): Promise<void> {
    const envContent = `WEBEX_ACCESS_TOKEN=${token.access_token}\nWEBEX_REFRESH_TOKEN=${token.refresh_token}\nWEBEX_TOKEN_EXPIRES_AT=${Date.now() + (token.expires_in * 1000)}\n`;
    
    // Read existing .env file if it exists
    let existingContent = '';
    if (fs.existsSync(this.envFilePath)) {
      existingContent = fs.readFileSync(this.envFilePath, 'utf8');
    }

    // Remove existing Webex tokens
    const lines = existingContent.split('\n').filter(line => 
      !line.startsWith('WEBEX_ACCESS_TOKEN=') && 
      !line.startsWith('WEBEX_REFRESH_TOKEN=') && 
      !line.startsWith('WEBEX_TOKEN_EXPIRES_AT=')
    );

    // Add new token
    const newContent = [...lines.filter(line => line.trim()), envContent].join('\n');
    
    fs.writeFileSync(this.envFilePath, newContent);
    
    // Also create a shell script that can be sourced
    const shellScript = `#!/bin/bash\n# Webex CLI Token Environment Variables\nexport WEBEX_ACCESS_TOKEN="${token.access_token}"\nexport WEBEX_REFRESH_TOKEN="${token.refresh_token}"\nexport WEBEX_TOKEN_EXPIRES_AT="${Date.now() + (token.expires_in * 1000)}"\n`;
    fs.writeFileSync(path.join(this.configDir, 'webex-env.sh'), shellScript);
    
    console.log(`✅ Token saved to ${this.envFilePath}`);
    console.log(`💡 To use the token in current session:`);
    console.log(`   source ~/.webex-cli/webex-env.sh`);
    console.log(`💡 To use permanently, add this to your shell profile (~/.bashrc, ~/.zshrc):`);
    console.log(`   source ~/.webex-cli/webex-env.sh`);
  }

  async validatePersonalToken(token: string): Promise<boolean> {
    try {
      console.log('   📡 Making API call to https://webexapis.com/v1/people/me');
      const response = await axios.get('https://webexapis.com/v1/people/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log(`   ✅ API Response: ${response.status} ${response.statusText}`);
      if (response.data && response.data.displayName) {
        console.log(`   👤 Authenticated as: ${response.data.displayName}`);
      }
      return response.status === 200;
    } catch (error: any) {
      console.log(`   ❌ API Error: ${error.response?.status || 'Unknown'} ${error.response?.statusText || error.message}`);
      if (error.response?.data) {
        console.log(`   📋 Error details: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      return false;
    }
  }

  displayPersonalTokenInfo(token: string): void {
    console.log('\n🎉 Personal Access Token extracted and validated!');
    console.log(`📋 Token Type: Personal Access Token`);
    console.log(`⏰ Expires: Never (Personal Access Tokens don't expire)`);
    console.log(`🔑 Access Token: ${token.substring(0, 20)}...`);
  }

  async getTokenAutomatically(): Promise<void> {
    console.log('🤖 Starting fully automated token extraction...');
    console.log('📋 This will:');
    console.log('   1. Launch a browser');
    console.log('   2. Navigate to Webex developer portal');
    console.log('   3. Wait for you to sign in');
    console.log('   4. Automatically extract your Personal Access Token');
    console.log('   5. Save and configure the token');
    console.log('');
    console.log('⚠️  You will need to sign in to Webex when the browser opens');
    console.log('');

    try {
      // Dynamic import for Puppeteer
      const puppeteer = await import('puppeteer');
      
      console.log('🚀 Launching browser...');
      const browser = await puppeteer.default.launch({ 
        headless: false, // Keep visible so user can sign in
        defaultViewport: null,
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--allow-running-insecure-content',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const page = await browser.newPage();
      
      // Minimize window immediately after launch
      console.log('🔽 Minimizing browser window to reduce distraction...');
      await page.evaluate(`() => {
        window.resizeTo(200, 100);
        window.moveTo(window.screen.availWidth - 200, window.screen.availHeight - 100);
      }`);
      
      // Grant clipboard permissions
      const context = browser.defaultBrowserContext();
      await context.overridePermissions('https://developer.webex.com', ['clipboard-read', 'clipboard-write']);
      
      console.log('🌐 Navigating to Webex developer portal...');
      await page.goto('https://developer.webex.com/docs/getting-started', {
        waitUntil: 'networkidle2'
      });

      // Get the current Mac username for auto-filling email
      const macUsername = process.env.USER || process.env.USERNAME || 'user';
      const autoEmail = `${macUsername}@cisco.com`;
      console.log(`🤖 Starting automated login for: ${autoEmail}`);

      try {
        // Step 1: Click the Login button
        console.log('🔍 Step 1: Clicking Login button...');
        await page.waitForSelector('#header-login-link', { timeout: 10000 });
        await page.click('#header-login-link');
        console.log('✅ Clicked Login button');

        // Step 2: Enter email into first input box
        console.log('🔍 Step 2: Entering email...');
        await page.waitForSelector('#IDToken1', { timeout: 10000 });
        await page.type('#IDToken1', autoEmail);
        console.log(`✅ Entered email: ${autoEmail}`);

        // Step 3: Click Sign In button
        console.log('🔍 Step 3: Clicking Sign In button...');
        await page.waitForSelector('#IDButton2', { timeout: 10000 });
        await page.click('#IDButton2');
        console.log('✅ Clicked Sign In button');

        // Step 4: Enter email into second input box
        console.log('🔍 Step 4: Entering email again...');
        const emailSelector2 = '#login-parent > div > div.display-flex.flex-direction-column.flex-value-one.size-padding-left-large.size-padding-right-large > label > input';
        await page.waitForSelector(emailSelector2, { timeout: 10000 });
        await page.type(emailSelector2, autoEmail);
        console.log(`✅ Entered email again: ${autoEmail}`);

        // Step 5: Click Next button
        console.log('🔍 Step 5: Clicking Next button...');
        const nextButtonSelector = '#login-parent > div > div.display-flex.flex-direction-column.flex-value-one.size-padding-left-large.size-padding-right-large > button';
        await page.waitForSelector(nextButtonSelector, { timeout: 10000 });
        await page.click(nextButtonSelector);
        console.log('✅ Clicked Next button');

        // Step 6: Focus password field and maximize window for user interaction
        console.log('🔍 Step 6: Focusing password field...');
        const passwordSelector = '#login-parent > div > div.display-flex.flex-direction-column.flex-value-one.size-padding-left-large.size-padding-right-large > form > label > input';
        await page.waitForSelector(passwordSelector, { timeout: 10000 });
        
        // Maximize window for password entry
        console.log('🔼 Maximizing window for password entry...');
        await page.evaluate(`() => {
          if (window.outerHeight < window.screen.availHeight || window.outerWidth < window.screen.availWidth) {
            window.resizeTo(window.screen.availWidth, window.screen.availHeight);
            window.moveTo(0, 0);
          }
        }`);
        
        await page.focus(passwordSelector);
        console.log('✅ Password field is now focused - you can type your password!');
        console.log('🔼 Window has been maximized for easier interaction');

        console.log('🔐 Please complete your password and MFA authentication...');
        console.log('⏳ The tool will automatically continue once you finish MFA...');

      } catch (stepError: any) {
        console.log(`⚠️  Automated flow failed at some step: ${stepError.message}`);
        console.log('👤 Please complete the login manually...');
        console.log('⏳ The tool will wait for you to finish and then extract the token...');
      }

      // Wait for MFA completion and "Yes, this is my device" button
      console.log('🔍 Step 7: Waiting for MFA completion...');
      try {
        // Wait for and click "Yes, this is my device" button
        await page.waitForSelector('#trust-browser-button', { timeout: 300000 }); // 5 minutes timeout
        await page.click('#trust-browser-button');
        console.log('✅ Clicked "Yes, this is my device" button');
        
        // Minimize window after MFA completion
        console.log('🔽 Minimizing window after MFA completion...');
        await page.evaluate(`() => {
          if (window.minimize) {
            window.minimize();
          } else {
            // Fallback: move window off-screen or resize to small
            window.resizeTo(100, 100);
            window.moveTo(window.screen.availWidth - 100, window.screen.availHeight - 100);
          }
        }`);
        
        // Wait for page to redirect back to developer portal
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (trustButtonError) {
        console.log('⚠️  Trust device button not found or timeout - continuing anyway...');
      }

      // Now extract the token using the simplified approach
      console.log('🔍 Step 8: Extracting token...');
      let token: string | null = null;
      
      try {
        // Step 8: Click on avatar button
        console.log('🔍 Looking for avatar button...');
        console.log('🔍 Current page URL:', await page.url());
        
        // Try the avatar selectors based on what we found in debug
        const avatarSelectors = [
          '#root > div > header > div > div > div.md-top-bar__right > div.md-top-bar__user > div', // Original selector
          '.md-top-bar__user', // Found in debug
          '.md-avatar', // Found in debug
          '.user-image', // Found in debug
          'div.md-top-bar__user',
          'div.md-avatar',
          'img.user-image'
        ];

        let avatarClicked = false;
        for (const selector of avatarSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            await page.click(selector);
            console.log('✅ Clicked avatar button');
            avatarClicked = true;
            break;
          } catch (selectorError) {
            // Continue to next selector
          }
        }

        if (!avatarClicked) {
          throw new Error('Could not find any clickable avatar element');
        }
        
        // Wait a moment for menu to appear after avatar click
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 9: Click copy token button
        console.log('🔍 Looking for copy token button...');
        const copyTokenSelector = '#copy-token-modal-button';
        await page.waitForSelector(copyTokenSelector, { timeout: 10000 });
        await page.click(copyTokenSelector);
        console.log('✅ Clicked copy token button');
        
        // Step 10: Click OK button to confirm copy
        console.log('🔍 Looking for OK button...');
        const okButtonSelector = '#confirm-copy-button';
        await page.waitForSelector(okButtonSelector, { timeout: 10000 });
        await page.click(okButtonSelector);
        console.log('✅ Clicked OK button');
        
        // Wait 1 second for copy to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Read from clipboard
        try {
          console.log('📋 Reading token from clipboard...');
          const clipboardText = await page.evaluate('navigator.clipboard.readText()') as string;
          console.log(`📋 Token extracted: ${clipboardText?.substring(0, 50) || 'empty'}...`);
          
          if (clipboardText && this.isValidTokenFormat(clipboardText)) {
            token = clipboardText.trim();
            console.log('✅ Successfully extracted token from clipboard!');
          } else {
            console.log(`❌ Invalid token format: "${clipboardText?.substring(0, 100) || 'empty'}"`);
          }
        } catch (clipError) {
          console.log(`❌ Could not read from clipboard: ${clipError}`);
        }
        
      } catch (extractError: any) {
        console.log(`❌ Token extraction failed: ${extractError.message}`);
      }

      await browser.close();

      if (!token) {
        console.log('⏰ Timeout: Could not automatically find the Personal Access Token');
        console.log('💡 This might happen if:');
        console.log('   • You haven\'t signed in yet');
        console.log('   • The token section hasn\'t loaded');
        console.log('   • The page structure has changed');
        console.log('');
        console.log('🔄 Please try running the command again and make sure to:');
        console.log('   1. Sign in to your Webex account');
        console.log('   2. Navigate to or scroll down to find the "Your Personal Access Token" section');
        await browser.close();
        return;
      }

      console.log('🎉 Token found automatically!');
      
      // Clean the token (remove any Bearer prefix or extra whitespace)
      token = token.replace(/^Bearer\s+/i, '').trim();

      // Debug: Show token details
      console.log('🔍 Token Debug Information:');
      console.log(`   Length: ${token.length} characters`);
      console.log(`   First 50 chars: ${token.substring(0, 50)}...`);
      console.log(`   Last 50 chars: ...${token.substring(token.length - 50)}`);
      console.log(`   Contains numbers: ${/\d/.test(token)}`);
      console.log(`   Contains uppercase: ${/[A-Z]/.test(token)}`);
      console.log(`   Contains lowercase: ${/[a-z]/.test(token)}`);
      console.log(`   Base64 format: ${/^[A-Za-z0-9+/]+=*$/.test(token)}`);

      // Validate the token
      console.log('🔍 Validating token with Webex API...');
      const isValid = await this.validatePersonalToken(token);
      if (!isValid) {
        console.log('❌ The extracted token appears to be invalid');
        console.log('💡 This could mean:');
        console.log('   • The wrong text was detected as a token');
        console.log('   • Network issues prevented validation');
        console.log('');
        console.log('🔄 Please try running the command again');
        return;
      }

      // Save the token
      const patTokenData = {
        access_token: token,
        refresh_token: '',
        expires_in: 0, // PATs don't expire
        token_type: 'Bearer'
      };

      this.displayPersonalTokenInfo(token);
      await this.saveToken(patTokenData);
      
      console.log('\n🎉 Fully automated setup complete! Your Personal Access Token is ready to use.');
      process.exit(0);

    } catch (error: any) {
      console.log(`❌ Browser automation failed: ${error.message}`);
      console.log('💡 Common issues and solutions:');
      console.log('   • Chrome/Chromium not installed: Install Google Chrome');
      console.log('   • Permission denied: Check browser permissions');
      console.log('   • Network issues: Check internet connection');
      console.log('');
      console.log('🔄 Please fix the issue and try again');
      process.exit(1);
    }
  }

  private isValidTokenFormat(text: string): boolean {
    // Personal Access Tokens are typically long base64-like strings
    const cleaned = text.replace(/^Bearer\s+/i, '').trim();
    
    // Webex Personal Access Tokens have a specific format
    // Example: YzAwMTQ5NWQtOWM1ZC00ZDg1LTk4MWYtYTEwZTg3MDE2YTE5MjBlNjQ3NTAtYjgz_PF84_1eb65fdf-9643-417f-9974-ad72cae0e10f
    
    // Should be quite long (typically 100+ characters)
    if (cleaned.length < 80) return false;
    
    // Should contain base64 characters including underscores and hyphens
    const webexTokenPattern = /^[A-Za-z0-9+/_-]+$/;
    if (!webexTokenPattern.test(cleaned)) return false;
    
    // Should not be JSON or contain JSON-like patterns
    const excludeJSONPatterns = [
      /trackingId/i,
      /^\{.*\}$/,  // JSON objects
      /^\[.*\]$/,  // JSON arrays
      /^".*"$/,    // Quoted strings
      /:\s*"/,     // JSON key-value pairs
      /,\s*"/,     // JSON comma-separated values
    ];
    
    for (const pattern of excludeJSONPatterns) {
      if (pattern.test(cleaned)) return false;
    }
    
    // Should not be common non-token strings or placeholders
    const excludePatterns = [
      /^example/i,
      /^sample/i,
      /^demo/i,
      /^test/i,
      /^your.token.here/i,
      /^replace.with/i,
      /^placeholder/i,
      /^xxxxxxxx/i,
      /^aaaaaa/i,
      /^111111/i,
      /^000000/i,
      /^insert.your/i,
      /^put.your/i,
      /^add.your/i,
      /^enter.your/i,
      /^copy.your/i,
      // Common placeholder patterns
      /^[x]{10,}/i,  // Multiple x's
      /^[a-z]{3,}[.][a-z]{3,}/i, // words with dots
    ];
    
    for (const pattern of excludePatterns) {
      if (pattern.test(cleaned)) return false;
    }

    // Webex tokens typically have mixed case and underscores/hyphens
    const hasNumbers = /\d/.test(cleaned);
    const hasUppercase = /[A-Z]/.test(cleaned);
    const hasLowercase = /[a-z]/.test(cleaned);
    const hasSpecialChars = /[_-]/.test(cleaned);
    
    if (!hasNumbers || !hasUppercase || !hasLowercase) {
      return false;
    }
    
    // Good sign if it has the typical Webex token structure
    if (hasSpecialChars) {
      return true;
    }
    
    return true;
  }

}

async function main() {
  const program = new Command();

  program
    .name('webex-auth')
    .description('CLI tool to authenticate with Webex APIs and store tokens')
    .version('1.0.0');

  program
    .command('login')
    .description('Automatically get your Webex Personal Access Token')
    .action(async (options) => {
      try {
        const tokenManager = new TokenManager();
        await tokenManager.getTokenAutomatically();
      } catch (error: any) {
        console.error('❌ Authentication failed:', error.message);
        process.exit(1);
      }
    });

  program
    .command('info')
    .description('Display information about stored tokens')
    .action(() => {
      const configDir = path.join(os.homedir(), '.webex-cli');
      const envPath = path.join(configDir, '.env');
      
      if (!fs.existsSync(envPath)) {
        console.log('❌ No token found. Run "webex-auth login" first.');
        return;
      }

      const envContent = fs.readFileSync(envPath, 'utf8');
      const accessToken = envContent.match(/WEBEX_ACCESS_TOKEN=(.+)/)?.[1];
      const refreshToken = envContent.match(/WEBEX_REFRESH_TOKEN=(.+)/)?.[1];
      const expiresAt = envContent.match(/WEBEX_TOKEN_EXPIRES_AT=(.+)/)?.[1];

      if (!accessToken) {
        console.log('❌ No Webex token found.');
        return;
      }

      console.log('📋 Webex Token Information:');
      console.log(`📁 Config Directory: ~/.webex-cli/`);
      console.log(`🔑 Access Token: ${accessToken.substring(0, 20)}...`);
      if (refreshToken) {
        console.log(`🔄 Refresh Token: ${refreshToken.substring(0, 20)}...`);
      }
      if (expiresAt) {
        const expiryTimestamp = parseInt(expiresAt);
        if (expiryTimestamp === 0) {
          console.log(`⏰ Expires: Never (Personal Access Token)`);
        } else {
          const expiry = new Date(expiryTimestamp);
          const isExpired = expiry < new Date();
          console.log(`⏰ Expires: ${expiry.toLocaleString()} ${isExpired ? '(EXPIRED)' : ''}`);
        }
      }
      console.log(`💡 To load token: source ~/.webex-cli/webex-env.sh`);
    });

  await program.parseAsync();
}

if (require.main === module) {
  main().catch(console.error);
}

export { TokenManager };