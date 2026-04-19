const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const ALLOWED_DISCORD_ID = '1274782339192328224';

// @route   GET api/auth/discord
// @desc    Initiate Discord OAuth
router.get('/discord', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI);
  if (!clientId || !redirectUri) {
    return res.status(500).send('Discord OAuth not configured');
  }
  
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
  res.redirect(discordAuthUrl);
});

// @route   GET api/auth/discord/callback
// @desc    Handle Discord callback and issue JWT
router.get('/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Discord Token Error:', tokenData);
      return res.redirect('/?error=oauth_failed');
    }

    // 2. Fetch User Profile
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });
    
    const userData = await userResponse.json();
    if (!userResponse.ok) {
      console.error('Discord User Error:', userData);
      return res.redirect('/?error=verify_failed');
    }

    // 3. Verify exactly allowed Discord ID
    if (userData.id !== ALLOWED_DISCORD_ID) {
      console.warn(`Unauthorized login attempt from Discord ID: ${userData.id}`);
      return res.redirect('/?error=unauthorized');
    }

    // 4. Issue JWT
    const payload = { admin: { id: userData.id, username: userData.username } };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) throw err;
        // Redirect back to frontend with the token
        res.redirect(`/?token=${token}`);
      }
    );

  } catch (err) {
    console.error('Discord Auth Error:', err.message);
    res.redirect('/?error=server_error');
  }
});

module.exports = router;
