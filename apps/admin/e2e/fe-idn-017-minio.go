// This acceptance helper uses the backend's existing MinIO SDK, without adding dependencies.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := minio.New("127.0.0.1:19000", &minio.Options{Creds: credentials.NewStaticV4(os.Getenv("MINIO_ROOT_USER"), os.Getenv("MINIO_ROOT_PASSWORD"), ""), Region: "us-east-1", BucketLookup: minio.BucketLookupPath})
	if err != nil {
		return err
	}
	const bucket = "fe-idn-017"
	if len(os.Args) != 2 {
		return fmt.Errorf("expected setup or verify")
	}
	if os.Args[1] == "verify" {
		count := 0
		for object := range client.ListObjects(ctx, bucket, minio.ListObjectsOptions{Recursive: true}) {
			if object.Err != nil {
				return object.Err
			}
			count++
		}
		fmt.Printf("remaining acceptance MinIO objects: %d\n", count)
		if count != 0 {
			return fmt.Errorf("acceptance objects remain")
		}
		return nil
	}
	if os.Args[1] != "setup" {
		return fmt.Errorf("unknown operation")
	}
	if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{Region: "us-east-1"}); err != nil {
		return err
	}
	policy, err := json.Marshal(map[string]any{"Version": "2012-10-17", "Statement": []any{map[string]any{"Effect": "Allow", "Principal": map[string]any{"AWS": []string{"*"}}, "Action": []string{"s3:GetObject"}, "Resource": []string{"arn:aws:s3:::" + bucket + "/*"}}}})
	if err != nil {
		return err
	}
	if err := client.SetBucketPolicy(ctx, bucket, string(policy)); err != nil {
		return err
	}
	fmt.Println("created isolated acceptance bucket with anonymous download")
	return nil
}
