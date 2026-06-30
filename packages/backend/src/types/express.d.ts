/// <reference types="express" />
/// <reference types="passport" />

declare global {
  namespace Express {
    // Extend Passport's base User interface with our fields
    interface User {
      id: string;
      email: string;
      tier: string;
    }

    interface Request {
      sessionId?: string;
    }
  }
}
