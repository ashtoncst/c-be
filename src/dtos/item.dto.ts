import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsPositive,
  IsBoolean,
  IsIn,
  Min,
} from "class-validator";
import { Expose } from "class-transformer";

// Item DTO for unified item model
export class ItemDto {
  @IsNumber()
  @Expose()
  id!: number;

  @IsString()
  @Expose()
  name!: string;

  @IsString()
  @IsOptional()
  @Expose()
  description?: string | null;

  @IsString()
  @IsIn(["solution", "category", "product"])
  @Expose()
  itemType!: "solution" | "category" | "product";

  @IsNumber()
  @IsOptional()
  @Expose()
  parentItemId?: number | null;

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

  @IsBoolean()
  @Expose()
  isActive!: boolean;

  @IsArray()
  @IsOptional()
  @Expose()
  features?: string[];

  @IsString()
  @Expose()
  createdAt!: string;

  @IsString()
  @IsOptional()
  @Expose()
  updatedAt?: string;
}

// Request DTO for adding items
export class CreateItemDto {
  @IsString()
  @Expose()
  name!: string;

  @IsString()
  @IsOptional()
  @Expose()
  description?: string;

  @IsString()
  @IsIn(["solution", "category", "product"])
  @Expose()
  itemType!: "solution" | "category" | "product";

  @IsNumber()
  @IsOptional()
  @Expose()
  parentItemId?: number | null;

  @IsString()
  @IsOptional()
  @Expose()
  price?: string;

  @IsString()
  @IsOptional()
  @Expose()
  contractTerm?: string;

  @IsNumber()
  @IsOptional()
  @Expose()
  targetAudienceId?: number;

  @IsArray()
  @IsOptional()
  @Expose()
  featureIds?: number[];
}

// Query DTO for filtering items
export class ItemQueryDto {
  @IsString()
  @IsOptional()
  @IsIn(["solution", "category", "product"])
  @Expose()
  itemType?: "solution" | "category" | "product";

  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Expose()
  parentItemId?: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Expose()
  targetAudienceId?: number;

  @IsBoolean()
  @IsOptional()
  @Expose()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  @Expose()
  search?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Expose()
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Expose()
  offset?: number;
}

// Response DTO for item lists
export class ItemListResponseDto {
  @IsArray()
  @Expose()
  items!: ItemDto[];

  @IsNumber()
  @Expose()
  total!: number;

  @IsNumber()
  @Expose()
  limit!: number;

  @IsNumber()
  @Expose()
  offset!: number;
}

// Parent info DTO for hierarchical display
export class ItemWithParentDto extends ItemDto {
  @IsOptional()
  @Expose()
  parentItem?: {
    id: number;
    name: string;
    itemType: "solution" | "category" | "product";
  };
}
