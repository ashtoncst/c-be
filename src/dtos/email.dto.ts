import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsArray,
  ValidateIf,
  Matches,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from "class-validator";
import { Expose } from "class-transformer";

export const EMAIL_TYPES = [
  "contact",
  "download",
  "newsletter",
  "pricing",
  "inquiry",
  "sales-lead",
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

export const LIMITS = {
  name: 100,
  email: 254,
  company: 150,
  address: 300,
  mobile: 20,
  inquiry: 2000,
} as const;

const PHONE_REGEX = /^[+]?[\d\s\-()]{7,20}$/;

// A lightweight shape for sales-lead product entries. Intentionally loose —
// the rendered template only reads productName/itemName/itemType.
export interface SelectedProduct {
  productName?: string;
  itemName?: string;
  itemType?: string;
}

export class SendEmailDto {
  @IsIn(EMAIL_TYPES, {
    message: `type must be one of: ${EMAIL_TYPES.join(", ")}`,
  })
  @Expose()
  type!: EmailType;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: "Name must be at least 2 characters." })
  @MaxLength(LIMITS.name, { message: `Name must be at most ${LIMITS.name} characters.` })
  @Expose()
  name!: string;

  @IsEmail({}, { message: "Please provide a valid email address." })
  @MaxLength(LIMITS.email)
  @Expose()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: "Company name must be at least 2 characters." })
  @MaxLength(LIMITS.company, {
    message: `Company name must be at most ${LIMITS.company} characters.`,
  })
  @Expose()
  company!: string;

  // contact + sales-lead require address
  @ValidateIf((o: SendEmailDto) => o.type === "contact" || o.type === "sales-lead")
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: "Please provide a valid office address." })
  @MaxLength(LIMITS.address)
  @Expose()
  address?: string;

  // contact + sales-lead require mobile
  @ValidateIf((o: SendEmailDto) => o.type === "contact" || o.type === "sales-lead")
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, {
    message: "Please provide a valid mobile number.",
  })
  @MaxLength(LIMITS.mobile)
  @Expose()
  mobile?: string;

  // contact requires inquiry (free-text message)
  @ValidateIf((o: SendEmailDto) => o.type === "contact")
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: "Inquiry must be between 10 and 2000 characters." })
  @MaxLength(LIMITS.inquiry, {
    message: "Inquiry must be between 10 and 2000 characters.",
  })
  @Expose()
  inquiry?: string;

  // download requires downloadUrl
  @ValidateIf((o: SendEmailDto) => o.type === "download")
  @IsString()
  @IsNotEmpty()
  @Expose()
  downloadUrl?: string;

  // Optional human-readable brochure label sent by the FE (authoritative when
  // present). Backend falls back to deriveBrochureLabel(url) when absent.
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Expose()
  downloadName?: string;

  // sales-lead requires selectedProducts (cart items)
  @ValidateIf((o: SendEmailDto) => o.type === "sales-lead")
  @IsArray()
  @ArrayMinSize(1, { message: "selectedProducts must have at least one item." })
  @Expose()
  selectedProducts?: SelectedProduct[];
}
