const multer = require('multer');

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB, según el diseño
  fileFilter: (req, file, cb) => {
    const hasAllowedExtension = /\.(pdf|docx)$/i.test(file.originalname || '');
    if (!ALLOWED_MIMETYPES.has(file.mimetype) && !hasAllowedExtension) {
      return cb(new Error('Solo se permiten archivos PDF o DOCX.'));
    }
    cb(null, true);
  },
});

module.exports = upload;
