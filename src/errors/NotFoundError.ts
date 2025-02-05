import { BaseError } from "./BaseError";

export class NotFoundError extends BaseError {
  constructor(description = "Resource not found") {
    super("NotFoundError", 404, true, description);
  }
}
