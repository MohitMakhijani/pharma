const prisma = require('../config/prisma');

function authorize(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.roleId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const role = await prisma.role.findUnique({
        where: {
          id: req.user.roleId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!role) {
        return res.status(403).json({
          success: false,
          message: 'User role not found',
        });
      }

      if (!allowedRoles.includes(role.name)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource',
        });
      }

      req.user.role = role.name;

      next();
    } catch (error) {
      console.error('Authorization error:', error);

      return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
      });
    }
  };
}

module.exports = {
  authorize,
};
