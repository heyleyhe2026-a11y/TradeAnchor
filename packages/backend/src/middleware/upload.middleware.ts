import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.pdf',
  '.ex4', '.mq4', '.mp4', '.ex5', '.mq5',
  '.png', '.jpg', '.jpeg',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** Fix garbled Chinese/non-ASCII filenames sent by browsers (latin1 → utf8) */
function decodeOriginalname(raw: string): string {
  if (!raw) return raw;
  // Only decode if the raw string contains non-ASCII bytes (indicates encoding mismatch)
  try {
    const hasNonAscii = [...raw].some(c => c.charCodeAt(0) > 127);
    if (!hasNonAscii) return raw;
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    return decoded || raw;
  } catch {
    return raw;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const decodedName = decodeOriginalname(file.originalname);
    const ext = path.extname(decodedName).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const decodedName = decodeOriginalname(file.originalname);
  const ext = path.extname(decodedName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type ${ext} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
  return cb(null, true);
};

/** Decode originalname on every processed file — call after upload middleware completes */
export function decodeFilenames(files?: Express.Multer.File[]): void {
  if (!files) return;
  for (const f of files) {
    f.originalname = decodeOriginalname(f.originalname);
  }
}

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const ALLOWED_EXTENSIONS_LIST = ALLOWED_EXTENSIONS;
export const MAX_UPLOAD_SIZE_MB = 10;
