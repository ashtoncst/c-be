import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsPositive,
  IsEmail,
  IsNotEmpty,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { Expose, Type } from "class-transformer";

// Session Management
export class SessionInfoDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  sessionId!: string;

  @IsNumber()
  @Expose()
  itemCount!: number;

  @IsString()
  @IsNotEmpty()
  @Expose()
  createdAt!: string;

  @IsString()
  @IsOptional()
  @Expose()
  expiresAt?: string;
}

// Cart Operations
export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  sessionId!: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Expose()
  productId?: number; // Optional: backward compatibility

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Expose()
  itemId?: number; // New: unified item model
}

export class RemoveFromCartDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  sessionId!: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Expose()
  productId?: number; // Optional: backward compatibility

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Expose()
  itemId?: number; // New: unified item model
}

export class ClearCartDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  sessionId!: string;
}

// Cart Response
export class CartItemDto {
  @IsNumber()
  @Expose()
  id!: number;

  @IsNumber()
  @IsOptional()
  @Expose()
  productId?: number; // Backward compatibility

  @IsNumber()
  @IsOptional()
  @Expose()
  itemId?: number; // New unified model

  @IsString()
  @IsNotEmpty()
  @Expose()
  productName!: string; // Keep for backward compatibility

  @IsString()
  @IsOptional()
  @Expose()
  itemName?: string; // New name

  @IsString()
  @IsOptional()
  @Expose()
  itemType?: "solution" | "category" | "product"; // New: type of item

  @IsString()
  @IsOptional()
  @Expose()
  description?: string | null;

  @IsString()
  @IsOptional()
  @Expose()
  price?: string | null;

  @IsString()
  @IsOptional()
  @Expose()
  contractTerm?: string | null;

  @IsString()
  @IsOptional()
  @Expose()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  @Expose()
  productCategory?: string; // Backward compatibility

  @IsString()
  @IsNotEmpty()
  @Expose()
  addedAt!: string;
}

export class CartResponseDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  sessionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  @Expose()
  items!: CartItemDto[];

  @IsNumber()
  @Min(0)
  @Expose()
  totalItems!: number;

  @IsString()
  @IsNotEmpty()
  @Expose()
  lastUpdated!: string;
}

// Lead Conversion
export class CreateSalesLeadDto {
  @IsString()
  @IsNotEmpty()
  @Expose()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  customerName!: string;

  @IsEmail()
  @IsNotEmpty()
  @Expose()
  customerEmail!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  officeAddress!: string;

  // Use regex pattern for phone validation instead of @IsPhoneNumber()
  // This pattern accepts international phone numbers in various formats
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+]?[()]?[\d\s\-()]{10,}$/, {
    message: "Phone number must be a valid international phone number",
  })
  @Expose()
  customerPhone!: string;
}

export class SalesLeadResponseDto {
  @IsNumber()
  @Expose()
  id!: number;

  @IsString()
  @IsNotEmpty()
  @Expose()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  customerEmail!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  officeAddress!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  customerPhone!: string;

  @IsString()
  @IsNotEmpty()
  @Expose()
  status!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  @Expose()
  selectedProducts!: CartItemDto[];

  @IsString()
  @IsNotEmpty()
  @Expose()
  createdAt!: string;
}
