// Test setup only: a new tenant has no authenticated actor to open registration.
// Run with the backend's existing Go module; this adds no frontend dependency.
package main

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	if !prepare() {
		os.Stderr.WriteString("Isolated registration fixture setup failed\n")
		os.Exit(1)
	}
}

func prepare() bool {
	id, err := strconv.ParseInt(os.Getenv("FE_IDN_002_TENANT_ID"), 10, 64)
	code := os.Getenv("FE_IDN_002_TENANT_CODE")
	if err != nil || id <= 1 || !strings.HasPrefix(code, "reg_") {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, os.Getenv("FE_IDN_002_DATABASE_URL"))
	if err != nil {
		return false
	}
	defer conn.Close(ctx)
	tx, err := conn.Begin(ctx)
	if err != nil {
		return false
	}
	defer tx.Rollback(ctx)
	var selected int64
	err = tx.QueryRow(ctx, `SELECT id FROM tenant WHERE id=$1 AND code=$2 AND status='active' FOR UPDATE`, id, code).Scan(&selected)
	if err != nil || selected != id {
		return false
	}
	var active int
	err = tx.QueryRow(ctx, `SELECT count(*) FROM sys_user WHERE tenant_id=$1 AND status='active' AND deleted_at IS NULL`, id).Scan(&active)
	if err != nil || active != 0 {
		return false
	}
	result, err := tx.Exec(ctx, `UPDATE tenant SET settings=settings || '{"allow_self_registration":true,"default_role_code":"","registration_hourly_limit":10000}'::jsonb WHERE id=$1 AND code=$2`, id, code)
	if err != nil || result.RowsAffected() != 1 {
		return false
	}
	return tx.Commit(ctx) == nil
}
