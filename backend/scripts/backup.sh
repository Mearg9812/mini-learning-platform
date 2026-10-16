#!/bin/bash
# PostgreSQL Automated Backup Script

# Setup variables
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="db_backup_$TIMESTAMP.sql"

echo "Starting database backup..."
# 1. Dump the PostgreSQL database into a file
pg_dump $DATABASE_URL > $BACKUP_FILE

echo "Uploading to Cloudflare R2..."
# 2. Upload the file to Cloudflare R2 using AWS CLI
aws s3 cp $BACKUP_FILE s3://$R2_BUCKET_NAME/backups/$BACKUP_FILE \
  --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com

# 3. Delete the local file to save space
rm $BACKUP_FILE

echo "Backup complete!"