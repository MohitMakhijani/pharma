const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'demo'
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Uploads a file buffer or dataURI / local path to Cloudinary
 * @param {string|Buffer} file - Base64 Data URI, URL, or buffer
 * @param {object} options
 */
async function uploadToCloudinary(file, options = {}) {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not set in .env');
  }

  const folder = options.folder || 'pharma/prescriptions';

  if (typeof file === 'string' && (file.startsWith('data:') || file.startsWith('http://') || file.startsWith('https://'))) {
    const result = await cloudinary.uploader.upload(file, {
      folder,
      resource_type: 'auto',
      ...options,
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
    };
  }

  // If buffer
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
    uploadStream.end(file);
  });
}

/**
 * Deletes an asset from Cloudinary using its public_id or extracted from URL
 * @param {string} publicIdOrUrl
 */
async function deleteFromCloudinary(publicIdOrUrl) {
  if (!publicIdOrUrl) return null;

  let publicId = publicIdOrUrl;

  // If full URL was provided, extract the public_id
  if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
    try {
      const parts = publicIdOrUrl.split('/upload/');
      if (parts[1]) {
        const withoutVersion = parts[1].replace(/^v\d+\//, '');
        publicId = withoutVersion.replace(/\.[^/.]+$/, ''); // Remove file extension
      }
    } catch {
      publicId = publicIdOrUrl;
    }
  }

  return cloudinary.uploader.destroy(publicId);
}

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
};
