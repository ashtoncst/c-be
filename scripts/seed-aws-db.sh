#!/bin/bash

# =============================================================================
# AWS Database Seeding Script for Converge Global Backend
# =============================================================================
# This script seeds the AWS RDS PostgreSQL database with the complete schema
# and product catalog data from the 2025 Omnibus Brochure.
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_SCRIPTS_DIR="$PROJECT_ROOT/docs/db-scripts"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v psql &> /dev/null; then
        print_error "psql is not installed. Please install PostgreSQL client tools."
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI."
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Function to load environment variables
load_env() {
    print_status "Loading environment variables..."
    
    # Check if .env file exists
    if [ -f "$PROJECT_ROOT/.env" ]; then
        source "$PROJECT_ROOT/.env"
        print_success "Loaded .env file"
    elif [ -f "$PROJECT_ROOT/env.aws.example" ]; then
        print_warning "No .env file found. Using env.aws.example as reference."
        print_warning "Please create a .env file with your actual AWS RDS credentials."
        source "$PROJECT_ROOT/env.aws.example"
    else
        print_error "No environment file found. Please create .env or env.aws.example"
        exit 1
    fi
    
    # Validate required environment variables
    required_vars=("DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables: ${missing_vars[*]}"
        print_error "Please set these in your .env file"
        exit 1
    fi
    
    print_success "Environment variables validated"
}

# Function to test database connection
test_connection() {
    print_status "Testing database connection..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Failed to connect to database"
        print_error "Please check your database credentials and network connectivity"
        exit 1
    fi
}

# Function to check if database is empty
check_database_state() {
    print_status "Checking database state..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if any tables exist
    table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [ "$table_count" -eq 0 ]; then
        print_status "Database is empty - will create schema and seed data"
        return 0
    else
        print_warning "Database contains $table_count tables"
        read -p "Do you want to continue? This may modify existing data. (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Operation cancelled by user"
            exit 0
        fi
        return 1
    fi
}

# Function to create database schema
create_schema() {
    print_status "Creating database schema..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if [ -f "$DB_SCRIPTS_DIR/db-creation.sql" ]; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_SCRIPTS_DIR/db-creation.sql"
        print_success "Database schema created successfully"
    else
        print_error "Schema file not found: $DB_SCRIPTS_DIR/db-creation.sql"
        exit 1
    fi
}

# Function to seed database with product data
seed_data() {
    print_status "Seeding database with product catalog data..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if [ -f "$DB_SCRIPTS_DIR/accurate-db.sql" ]; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_SCRIPTS_DIR/accurate-db.sql"
        print_success "Product catalog data seeded successfully"
    else
        print_error "Seed data file not found: $DB_SCRIPTS_DIR/accurate-db.sql"
        exit 1
    fi
}

# Function to apply database updates
apply_updates() {
    print_status "Applying database updates..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if [ -f "$DB_SCRIPTS_DIR/db-updates.sql" ]; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_SCRIPTS_DIR/db-updates.sql"
        print_success "Database updates applied successfully"
    else
        print_warning "No update file found: $DB_SCRIPTS_DIR/db-updates.sql"
    fi
}

# Function to verify seeding
verify_seeding() {
    print_status "Verifying database seeding..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check table counts
    tables=("target_audience" "product_category" "feature" "product" "product_feature")
    
    for table in "${tables[@]}"; do
        count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
        print_status "Table '$table': $count records"
    done
    
    # Check for sample data
    sample_product=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT name FROM product LIMIT 1;" | tr -d ' ')
    
    if [ -n "$sample_product" ]; then
        print_success "Database seeding verified - found product: $sample_product"
    else
        print_error "Database seeding verification failed - no products found"
        exit 1
    fi
}

# Function to display connection info
display_connection_info() {
    print_status "Database connection information:"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
    print_status "You can connect to the database using:"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    echo ""
}

# Main execution
main() {
    echo "============================================================================="
    echo "AWS Database Seeding Script for Converge Global Backend"
    echo "============================================================================="
    echo ""
    
    check_dependencies
    load_env
    test_connection
    
    if check_database_state; then
        create_schema
    fi
    
    seed_data
    apply_updates
    verify_seeding
    
    echo ""
    print_success "Database seeding completed successfully!"
    display_connection_info
    
    echo ""
    print_status "Next steps:"
    echo "  1. Test your application connection to the database"
    echo "  2. Run your application tests to verify everything works"
    echo "  3. Consider setting up automated backups"
    echo ""
}

# Run main function
main "$@"
