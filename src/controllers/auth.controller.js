const {
  registerUser,
  loginUser,
  getCurrentUser,
} = require('../services/auth.service');

async function register(req, res) {
  try {
    const result = await registerUser(req.body);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    console.error('Register error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
}

async function login(req, res) {
  try {
    const result = await loginUser(req.body);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(401).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
}

async function me(req, res) {
  try {
    const user = await getCurrentUser(req.user.userId);

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message || 'User not found',
    });
  }
}

module.exports = {
  register,
  login,
  me,
};
