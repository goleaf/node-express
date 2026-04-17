import multer from 'multer';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Avatar must be a JPEG, PNG, or WebP image.'));
      return;
    }

    callback(null, true);
  },
});

export { avatarUpload, allowedMimeTypes };
export default avatarUpload;
