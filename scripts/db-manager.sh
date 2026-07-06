#!/bin/bash

# =============================================================================
# Database Manager for Converge Global Backend
# =============================================================================
# This script provides a comprehensive interface for managing the AWS RDS
# PostgreSQL database, including seeding, schema management, and maintenance.
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_SCRIPTS_DIR="$PROJECT_ROOT/docs/db-scripts"

# Function to print colored output
print_header() {
    echo -e "${PURPLE}=============================================================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}=============================================================================${NC}"
}

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

print_menu() {
    echo -e "${CYAN}$1${NC}"
}

# Function to check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    local missing_tools=()
    
    if ! command -v psql &> /dev/null; then
        missing_tools+=("psql")
    fi
    
    if ! command -v aws &> /dev/null; then
        missing_tools+=("aws")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again."
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
        return 0
    else
        print_error "Failed to connect to database"
        print_error "Please check your database credentials and network connectivity"
        return 1
    fi
}

# Function to display database status
show_database_status() {
    print_header "Database Status"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Connection info
    echo -e "${CYAN}Connection Information:${NC}"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
    
    # Database info
    echo -e "${CYAN}Database Information:${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            'Database Size' as metric,
            pg_size_pretty(pg_database_size(current_database())) as value
        UNION ALL
        SELECT 
            'Connection Count',
            count(*)::text
        FROM pg_stat_activity 
        WHERE datname = current_database()
        UNION ALL
        SELECT 
            'Table Count',
            count(*)::text
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    "
    
    echo ""
    
    # Table information
    echo -e "${CYAN}Table Information:${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            (SELECT count(*) FROM information_schema.columns WHERE table_name = tablename) as columns
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    "
}

# Function to seed telecom database
seed_telecom_database() {
    print_header "Seeding Telecom Database"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if database is empty
    table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [ "$table_count" -eq 0 ]; then
        print_status "Database is empty - creating schema and seeding data"
        
        # Create schema
        if [ -f "$DB_SCRIPTS_DIR/db-creation.sql" ]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_SCRIPTS_DIR/db-creation.sql"
            print_success "Database schema created successfully"
        else
            print_error "Schema file not found: $DB_SCRIPTS_DIR/db-creation.sql"
            return 1
        fi
        
        # Seed data
        if [ -f "$DB_SCRIPTS_DIR/accurate-db.sql" ]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_SCRIPTS_DIR/accurate-db.sql"
            print_success "Product catalog data seeded successfully"
        else
            print_error "Seed data file not found: $DB_SCRIPTS_DIR/accurate-db.sql"
            return 1
        fi
        
        # Apply updates
        if [ -f "$DB_SCRIPTS_DIR/db-updates.sql" ]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_SCRIPTS_DIR/db-updates.sql"
            print_success "Database updates applied successfully"
        fi
        
    else
        print_warning "Database contains $table_count tables"
        read -p "Do you want to continue? This may modify existing data. (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Operation cancelled by user"
            return 0
        fi
        
        # Just seed data without recreating schema
        if [ -f "$DB_SCRIPTS_DIR/accurate-db.sql" ]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_SCRIPTS_DIR/accurate-db.sql"
            print_success "Product catalog data seeded successfully"
        fi
    fi
    
    # Verify seeding
    print_status "Verifying database seeding..."
    tables=("target_audience" "product_category" "feature" "product" "product_feature")
    
    for table in "${tables[@]}"; do
        count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
        print_status "Table '$table': $count records"
    done
    
    print_success "Telecom database seeding completed successfully!"
}

# Function to seed wine database
seed_wine_database() {
    print_header "Seeding Wine Database"
    
    print_warning "This will create wine-specific tables in your database."
    print_warning "Make sure you want to use the wine business schema instead of the telecom schema."
    read -p "Continue with wine database setup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled by user"
        return 0
    fi
    
    # Run the wine seeding script
    if [ -f "$SCRIPT_DIR/seed-wine-db.sh" ]; then
        bash "$SCRIPT_DIR/seed-wine-db.sh"
    else
        print_error "Wine seeding script not found: $SCRIPT_DIR/seed-wine-db.sh"
        return 1
    fi
}

# Function to backup database
backup_database() {
    print_header "Database Backup"
    
    local backup_file="$PROJECT_ROOT/backups/db_backup_$(date +%Y%m%d_%H%M%S).sql"
    local backup_dir="$(dirname "$backup_file")"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$backup_dir"
    
    print_status "Creating database backup..."
    print_status "Backup file: $backup_file"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-password --verbose --clean --if-exists --create > "$backup_file"; then
        print_success "Database backup created successfully"
        print_status "Backup size: $(du -h "$backup_file" | cut -f1)"
    else
        print_error "Database backup failed"
        return 1
    fi
}

# Function to restore database
restore_database() {
    print_header "Database Restore"
    
    # List available backups
    local backup_dir="$PROJECT_ROOT/backups"
    
    if [ ! -d "$backup_dir" ] || [ -z "$(ls -A "$backup_dir" 2>/dev/null)" ]; then
        print_error "No backup files found in $backup_dir"
        return 1
    fi
    
    echo -e "${CYAN}Available backups:${NC}"
    ls -la "$backup_dir"/*.sql | nl
    
    read -p "Enter the number of the backup to restore (or 0 to cancel): " backup_choice
    
    if [ "$backup_choice" -eq 0 ]; then
        print_status "Restore cancelled by user"
        return 0
    fi
    
    local backup_file=$(ls "$backup_dir"/*.sql | sed -n "${backup_choice}p")
    
    if [ -z "$backup_file" ]; then
        print_error "Invalid backup selection"
        return 1
    fi
    
    print_warning "This will completely replace your current database!"
    read -p "Are you sure you want to restore from $backup_file? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled by user"
        return 0
    fi
    
    print_status "Restoring database from: $backup_file"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_file"; then
        print_success "Database restored successfully"
    else
        print_error "Database restore failed"
        return 1
    fi
}

# Function to show main menu
show_main_menu() {
    print_header "Database Manager"
    
    print_menu "Select an option:"
    echo "  1) Show database status"
    echo "  2) Test database connection"
    echo "  3) Seed telecom database (Converge products)"
    echo "  4) Seed wine database (Wine business)"
    echo "  5) Backup database"
    echo "  6) Restore database"
    echo "  7) Connect to database (psql)"
    echo "  8) Exit"
    echo ""
}

# Function to connect to database
connect_to_database() {
    print_header "Database Connection"
    
    print_status "Connecting to database..."
    print_status "Use \\q to quit, \\? for help"
    echo ""
    
    export PGPASSWORD="$DB_PASSWORD"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
}

# Main execution
main() {
    # Check dependencies and load environment
    check_dependencies
    load_env
    
    # Test connection first
    if ! test_connection; then
        print_error "Cannot proceed without database connection"
        exit 1
    fi
    
    # Main menu loop
    while true; do
        show_main_menu
        read -p "Enter your choice (1-8): " choice
        
        case $choice in
            1)
                show_database_status
                ;;
            2)
                test_connection
                ;;
            3)
                seed_telecom_database
                ;;
            4)
                seed_wine_database
                ;;
            5)
                backup_database
                ;;
            6)
                restore_database
                ;;
            7)
                connect_to_database
                ;;
            8)
                print_status "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid choice. Please enter a number between 1-8."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        clear
    done
}

# Run main function
main "$@"
