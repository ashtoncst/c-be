# Converge Global Backend - Postman Collections

This directory contains comprehensive API test collections for the Converge Global Backend service.

## Collections Overview

### 1. **chat.postman.json** - Socket.IO Chat Tests

- **Purpose**: Tests WebSocket/Socket.IO chat functionality
- **Endpoints**: Socket.IO real-time chat communication
- **Test Scenarios**: 4 comprehensive chat scenarios including discovery, business intent, multi-turn conversations, and error handling

### 2. **cart-api.postman.json** - Cart API Tests

- **Purpose**: Complete REST API tests for cart functionality
- **Endpoints**: 8 cart endpoints covering session management, cart operations, and sales lead conversion
- **Test Coverage**: Session creation, product add/remove, cart viewing, clearing, and conversion to sales leads

### 3. **item-api.postman.json** - Item API Tests (NEW)

- **Purpose**: REST API tests for unified item model (solutions, categories, products)
- **Endpoints**: 9 item endpoints including hierarchy, filtering, and search
- **Test Coverage**: Solutions, categories, products, hierarchy, search, and target audiences

### 4. **target-audience-tests.postman.json** - Target Audience Integration Tests (NEW)

- **Purpose**: Comprehensive tests for target audience filtering and seeded database validation
- **Endpoints**: Item API endpoints with target audience filtering
- **Test Coverage**: 67 seeded items verification, 10 target audience filtering, industry-specific products, item hierarchy, pagination
- **Key Tests**:
  - Verify all 67 items seeded (7 solutions, 25 categories, 35 products)
  - Hospitality filtering (21 items)
  - SME filtering (17 items including 16 Fiber Broadband products)
  - Banking & Financial Services filtering (5 items)
  - Cross-industry search and hierarchy validation

### 5. **product-api.postman.json** - Product API Tests (LEGACY)

- **Purpose**: REST API tests for product catalog functionality (backward compatibility)
- **Endpoints**: 4 product endpoints including metadata and individual product retrieval
- **Test Coverage**: Target audiences, categories, product listing with filtering, and individual product details

### 6. **health-chat-api.postman.json** - Health & Chat History Tests

- **Purpose**: System health and chat history functionality
- **Endpoints**: Health check and chat history retrieval
- **Test Coverage**: Service health monitoring and conversation history access

### 7. **environment.postman.json** - Local Environment Variables

- **Purpose**: Shared environment variables for local development
- **Variables**: Base URLs (localhost:3000), auto-populated IDs for testing workflows
- **Usage**: Use this for local development and testing

### 8. **converge-staging-environment.postman.json** - Staging Environment Variables

- **Purpose**: Environment variables for AWS staging deployment
- **Variables**: ALB URLs, RDS endpoint, ECS cluster info, auto-populated test IDs
- **Usage**: Use this to test against the staging environment on AWS

## API Coverage Summary

| Service                         | Endpoints   | Test Coverage | Status |
| ------------------------------- | ----------- | ------------- | ------ |
| **Item API** (NEW)              | 9 endpoints | ✅ Complete   | 100%   |
| **Target Audience Tests** (NEW) | 28 tests    | ✅ Complete   | 100%   |
| **Cart API**                    | 8 endpoints | ✅ Updated    | 100%   |
| **Product API**                 | 4 endpoints | ✅ Legacy     | 100%   |
| **Health Check**                | 1 endpoint  | ✅ Complete   | 100%   |
| **Chat History**                | 1 endpoint  | ✅ Complete   | 100%   |
| **Socket.IO Chat**              | WebSocket   | ✅ Complete   | 100%   |

**Total API Coverage: 22 endpoints + 28 specialized tests (100%)**

### Target Audience Test Breakdown:

- **Database Seeding Verification**: 4 tests (67 items, 7 solutions, 25 categories, 35 products)
- **Target Audience Filtering**: 4 tests (10 audiences, Hospitality, SME, Banking)
- **Industry-Specific Products**: 3 tests (14 hospitality products, 16 SME products, satellite)
- **Item Hierarchy**: 3 tests (full hierarchy, Internet categories, Fiber Broadband products)
- **Cross-Industry Search**: 2 tests (managed services, security solutions)
- **Pagination**: 2 tests (first page, second page)

### New Item API Endpoints:

- GET /items/solutions
- GET /items/categories
- GET /items/categories?solution_id={id}
- GET /items/products
- GET /items/products?category_id={id}
- GET /items/hierarchy
- GET /items/{id}
- GET /items (with filtering)
- GET /items/target-audiences

## Setup Instructions

### 1. Import Collections

1. Open Postman
2. Import all `.json` files from this directory
3. Import the `environment.postman.json` file

### 2. Configure Environment

- Set `base_url` to your API endpoint (default: `http://localhost:3000`)
- Set `ws_url` to your WebSocket endpoint (default: `ws://localhost:3000`)
- Other variables are auto-populated during test execution

### 3. Run Tests

- **Individual Tests**: Run specific requests manually
- **Collection Runner**: Execute entire collections for comprehensive testing
- **Newman CLI**: Run collections from command line for CI/CD integration

## Test Features

### Automated Test Validation

- ✅ Status code validation
- ✅ Response structure validation
- ✅ Data type verification
- ✅ Business logic validation
- ✅ Error handling verification

### Auto-Populated Variables

- Session IDs are automatically stored from cart operations
- Product IDs are captured for individual product tests
- Filter IDs are extracted for filtering test scenarios

### Comprehensive Error Testing

- Invalid ID formats
- Non-existent resources
- Missing required fields
- Invalid parameter combinations

## Workflow Testing

### Cart Workflow

1. **Create Session** → Generates session ID
2. **Add Item** → Adds item using itemId (NEW) or productId (LEGACY)
3. **View Cart** → Verifies items in cart
4. **Get Count** → Checks item count
5. **Remove Item** → Removes specific product
6. **Clear Cart** → Empties entire cart
7. **Convert to Lead** → Creates sales lead

### Item Discovery Workflow (NEW)

1. **Get Solutions** → Lists all top-level solutions
2. **Get Categories** → Lists categories (optionally filtered by solution)
3. **Get Products** → Lists products (optionally filtered by category)
4. **Get Hierarchy** → Shows complete solution → category → product tree
5. **Search Items** → Search across all item types
6. **View Item Details** → Get single item with features

### Product Discovery Workflow

1. **Get Target Audiences** → Lists available audiences
2. **Get Categories** → Lists product categories
3. **Filter Products** → Applies audience/category filters
4. **View Individual Product** → Gets detailed product info

## Environment Configuration

### Local Development

```json
{
  "base_url": "http://localhost:3000",
  "ws_url": "ws://localhost:3000"
}
```

### Staging Environment

```json
{
  "base_url": "https://staging-api.converge.com",
  "ws_url": "wss://staging-api.converge.com"
}
```

### Production Environment

```json
{
  "base_url": "https://api.converge.com",
  "ws_url": "wss://api.converge.com"
}
```

## Running Tests with Newman (CLI)

```bash
# Install Newman
npm install -g newman

# Run all collections (Local Development)
newman run postman/item-api.postman.json -e postman/environment.postman.json
newman run postman/target-audience-tests.postman.json -e postman/environment.postman.json
newman run postman/cart-api.postman.json -e postman/environment.postman.json
newman run postman/product-api.postman.json -e postman/environment.postman.json
newman run postman/health-chat-api.postman.json -e postman/environment.postman.json

# Run all collections (AWS Staging)
newman run postman/item-api.postman.json -e postman/converge-staging-environment.postman.json
newman run postman/target-audience-tests.postman.json -e postman/converge-staging-environment.postman.json
newman run postman/cart-api.postman.json -e postman/converge-staging-environment.postman.json
newman run postman/product-api.postman.json -e postman/converge-staging-environment.postman.json
newman run postman/health-chat-api.postman.json -e postman/converge-staging-environment.postman.json

# Run target audience tests specifically (verifies seeded database)
newman run postman/target-audience-tests.postman.json -e postman/converge-staging-environment.postman.json

# Run with HTML report
newman run postman/target-audience-tests.postman.json -e postman/converge-staging-environment.postman.json -r html --reporter-html-export target-audience-report.html

# Run all tests with summary
newman run postman/item-api.postman.json -e postman/environment.postman.json && \
newman run postman/target-audience-tests.postman.json -e postman/environment.postman.json && \
newman run postman/cart-api.postman.json -e postman/environment.postman.json
```

## Integration with CI/CD

These collections can be integrated into your CI/CD pipeline:

1. **GitHub Actions**: Use Newman to run tests on every commit
2. **Jenkins**: Add Newman step to build pipeline
3. **Azure DevOps**: Use Newman extension for automated testing
4. **Docker**: Run tests in containerized environments

## Troubleshooting

### Common Issues

- **Connection Refused**: Ensure backend server is running on specified port
- **Timeout Errors**: Check network connectivity and server response times
- **Authentication Issues**: Verify no authentication is required (or add auth headers)
- **Missing Data**: Ensure database is seeded with test data

### Debug Tips

- Check Postman Console for detailed request/response logs
- Verify environment variables are correctly set
- Test individual endpoints before running full collections
- Review server logs for backend error details

## Testing Target Audience Integration

### Quick Start

1. **Ensure database is seeded**:

   ```bash
   npm run seed:items
   ```

2. **Start the server**:

   ```bash
   npm run dev
   ```

3. **Import Postman collections**:

   - Import `target-audience-tests.postman.json`
   - Import `environment.postman.json` or `converge-staging-environment.postman.json`

4. **Run the tests**:
   - Use Postman Collection Runner for all 28 tests
   - Or run individual test folders for specific scenarios

### Expected Test Results

When all 67 items are properly seeded:

- ✅ **Verify All 67 Items Seeded** - Total: 67 items
- ✅ **Verify 7 Solutions** - Exactly 7 solutions
- ✅ **Verify 25 Categories** - Exactly 25 categories
- ✅ **Verify 35 Products** - Exactly 35 products
- ✅ **Get All Target Audiences** - Exactly 10 audiences
- ✅ **Filter Items by Hospitality** - 21 items (1 solution, 6 categories, 14 products)
- ✅ **Filter Items by SME** - 17 items (1 category, 16 products)
- ✅ **Filter Items by Banking** - 5 items (1 solution, 4 categories)
- ✅ **Get Hospitality Products Only** - 14 products
- ✅ **Get SME Fiber Broadband Products** - 16 products

### Testing Against AWS Staging

To test the staging environment:

1. Use `converge-staging-environment.postman.json` environment
2. The ALB URL is: `http://converge-backend-staging-alb-714495544.ap-southeast-1.elb.amazonaws.com`
3. Database is: `converge-backend-staging-db.cnokye2me3gj.ap-southeast-1.rds.amazonaws.com:5432`
4. All 67 items are seeded in staging database

### Common Test Scenarios

#### Scenario 1: Verify Database Seeding

Run the "1. Verify Database Seeding" folder to confirm all items are properly seeded.

#### Scenario 2: Test Industry Filtering

Run the "2. Target Audience Tests" folder to verify filtering works for all 10 industries.

#### Scenario 3: Test Product Discovery

Run the "3. Industry-Specific Product Tests" folder to verify products are correctly categorized by industry.

#### Scenario 4: Test Hierarchy

Run the "4. Item Hierarchy Tests" folder to verify the solution → category → product structure.

### Chatbot Integration Testing

The target audience system integrates with the chatbot. To test:

1. Use WebSocket client or Socket.IO to connect to chat
2. Send industry-specific queries:
   - "I need internet for my hotel" → Should recommend Hospitality items
   - "We're a bank looking for security" → Should recommend Banking & Financial items
   - "Small business fiber broadband" → Should recommend SME products
3. Verify chatbot filters recommendations by detected target audience

## Performance Benchmarks

Expected response times (local development):

- GET /items (all 67 items): < 100ms
- GET /items/solutions: < 50ms
- GET /items/categories: < 50ms
- GET /items/products: < 100ms
- GET /items?target_audience_id=X: < 100ms
- GET /items/hierarchy: < 200ms

Expected response times (AWS staging):

- Add ~50-100ms for network latency
- Database queries optimized with indexes on target_audience_id

## Data Validation

The target audience tests validate:

1. ✅ **Data Integrity**: All 67 items have proper parent-child relationships
2. ✅ **Target Audience Assignment**: All items have correct target_audience_id
3. ✅ **Active Status**: All items are marked as active (is_active = TRUE)
4. ✅ **Hierarchy**: Solutions → Categories → Products structure is valid
5. ✅ **Filtering**: Target audience filtering returns correct items
6. ✅ **Search**: Full-text search works across all item types
7. ✅ **Pagination**: Paginated results return correct totals and offsets
