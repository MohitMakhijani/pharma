const express = require('express');
const multer = require('multer');
const router = express.Router();
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { authenticate } = require('../middleware/auth.middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

router.use(authenticate);

// Upload single or multiple images to Cloudinary
router.post('/upload/prescription', upload.array('files', 5), async (req, res) => {
  try {
    const uploadedUrls = [];

    // Case 1: multipart/form-data files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, {
          folder: `pharma/${req.user.storeId}/prescriptions`,
        });
        uploadedUrls.push(result.url);
      }
    }
    // Case 2: JSON payload with base64 Data URLs or URLs
    else if (req.body.images && Array.isArray(req.body.images)) {
      for (const img of req.body.images) {
        if (typeof img === 'string') {
          if (img.startsWith('http://res.cloudinary.com') || img.startsWith('https://res.cloudinary.com')) {
            uploadedUrls.push(img);
          } else {
            const result = await uploadToCloudinary(img, {
              folder: `pharma/${req.user.storeId}/prescriptions`,
            });
            uploadedUrls.push(result.url);
          }
        }
      }
    }

    return res.json({
      success: true,
      data: uploadedUrls,
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload images to Cloudinary',
    });
  }
});

// Delete an image from Cloudinary
router.delete('/upload/prescription', async (req, res) => {
  try {
    const { url, publicId } = req.body;
    const target = publicId || url;

    if (!target) {
      return res.status(400).json({
        success: false,
        message: 'Image URL or publicId is required for deletion',
      });
    }

    const result = await deleteFromCloudinary(target);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete image from Cloudinary',
    });
  }
});

module.exports = router;
