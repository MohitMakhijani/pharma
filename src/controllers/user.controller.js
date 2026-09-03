const userService = require('../services/user.service');

async function getUsers(req, res, next) {
  try {
    const users = await userService.getUsers(req.user.storeId);

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

async function getRoles(req, res, next) {
  try {
    const roles = await userService.getRoles();

    return res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  getRoles,
};

async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(
      req.params.id,
      req.user.storeId
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports.getUserById = getUserById;

async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(
      req.body,
      req.user.storeId
    );

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports.createUser = createUser;

async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(
      req.params.id,
      req.user.storeId,
      req.body
    );

    return res.json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports.updateUser = updateUser;
