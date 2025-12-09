FROM postgres:16

# 1. Update apt and install pg_cron
RUN apt-get update && apt-get install -y postgresql-16-cron

# 2. Cleanup to keep image small
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# 3. Configure Postgres to load pg_cron on startup
# This is crucial. If you don't do this, CREATE EXTENSION will fail.
RUN echo "shared_preload_libraries = 'pg_cron'" >> /usr/share/postgresql/postgresql.conf.sample

# 4. By default, pg_cron runs on the 'postgres' database.
# If you want it to run jobs on 'openmovement', we configure that database name:
RUN echo "cron.database_name = 'openmovement'" >> /usr/share/postgresql/postgresql.conf.sample
