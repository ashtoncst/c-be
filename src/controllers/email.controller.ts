import { Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SendEmailDto } from "../dtos/email.dto.js";
import { emailService } from "../services/email.service.js";
import { asyncHandler } from "../utils/async.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "EmailController" });

// Public contract (matches what the 5 FE modal components consume):
//   success → 200 { success: true }
//   failure → 400/500 { error: string }
// Bypasses the standard { success: false, error: { message, ... } } wrapper
// from the global error handler because the FE expects a flat error string.
class EmailController {
  send = asyncHandler(async (req: Request, res: Response) => {
    const dto = plainToInstance(SendEmailDto, req.body);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      // Surface the first constraint message — FE displays this verbatim.
      const firstError = validationErrors.find(
        (e) => e.constraints && Object.keys(e.constraints).length > 0
      );
      const message =
        firstError && firstError.constraints
          ? Object.values(firstError.constraints)[0]
          : "Invalid request data.";

      logger.warn("Rejected email request: DTO validation failed", {
        type: req.body?.type,
        property: firstError?.property,
      });
      res.status(400).json({ error: message });
      return;
    }

    const sent = await emailService.send(dto.type, dto);

    if (!sent) {
      res.status(500).json({
        error: "Failed to send email. Please try again later.",
      });
      return;
    }

    res.status(200).json({ success: true });
  });
}

export const emailController = new EmailController();
