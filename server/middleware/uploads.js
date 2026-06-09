const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const safeExtension = (originalName = "", fallback = ".bin") => {
  const ext = path.extname(originalName).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : fallback;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = safeExtension(file.originalname, file.mimetype === "application/pdf" ? ".pdf" : ".jpg");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const imageOnly = (req, file, cb) => {
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (allowedMimeTypes.has(file.mimetype)) return cb(null, true);
  return cb(new Error("Разрешени са само JPG, PNG, WEBP или GIF изображения"));
};

const proofDocumentOnly = (req, file, cb) => {
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (allowedMimeTypes.has(file.mimetype)) return cb(null, true);
  return cb(new Error("Документът за доказване на собственост трябва да бъде JPG, PNG, WEBP или PDF файл"));
};

const upload = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const claimUpload = multer({
  storage,
  fileFilter: proofDocumentOnly,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const lakePhotoUpload = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024, files: 12 },
});

module.exports = {
  uploadDir,
  storage,
  upload,
  claimUpload,
  lakePhotoUpload,
};
