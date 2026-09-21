package io

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/base64"
	"fmt"
	"iappx_k8s_admin/core/utils"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/browser"
)

const (
	Binary = "Binary"
	Text   = "Text"
)

type IoService struct{}

func (a *IoService) WriteFile(path string, content string, options IOOptions) IOResult {
	log.Printf("WriteFile [%s %s]: %s", options.Mode, options.Range, path)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	if err := os.MkdirAll(filepath.Dir(fullPath), os.ModePerm); err != nil {
		return IOResult{false, err.Error()}
	}

	var data []byte

	switch options.Mode {
	case Text:
		data = []byte(content)
	case Binary:
		data, err = base64.StdEncoding.DecodeString(content)
		if err != nil {
			return IOResult{false, err.Error()}
		}
	default:
		return IOResult{false, "Unsupported IO mode: " + options.Mode}
	}

	file, err := os.OpenFile(fullPath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return IOResult{false, err.Error()}
	}
	fileSize := stat.Size()

	var start, end int64

	if options.Range == "" {
		start = 0
		end = int64(len(data)) - 1

		if err := file.Truncate(0); err != nil {
			return IOResult{false, err.Error()}
		}
	} else {
		start, end, err = utils.ParseRange(options.Range, fileSize)
		if err != nil {
			return IOResult{false, err.Error()}
		}

		writeLength := int64(len(data))
		if writeLength != end-start+1 {
			return IOResult{false, "data length does not match range length"}
		}
	}

	_, err = file.WriteAt(data, start)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) ReadFile(path string, options IOOptions) IOResult {
	log.Printf("ReadFile [%s %s]: %s", options.Mode, options.Range, path)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	file, err := os.Open(fullPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return IOResult{false, err.Error()}
	}
	fileSize := stat.Size()

	start, end, err := utils.ParseRange(options.Range, fileSize)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	length := end - start + 1
	buf := make([]byte, length)

	n, err := file.ReadAt(buf, start)
	if err != nil && err != io.EOF {
		return IOResult{false, err.Error()}
	}
	buf = buf[:n]

	switch options.Mode {
	case Text:
		return IOResult{true, string(buf)}
	case Binary:
		return IOResult{true, base64.StdEncoding.EncodeToString(buf)}
	default:
		return IOResult{false, "Unsupported IO mode: " + options.Mode}
	}
}

func (a *IoService) MoveFile(source string, target string) IOResult {
	log.Printf("MoveFile: %s -> %s", source, target)

	fullSource, err := utils.ResolvePath(source)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	fullTarget, err := utils.ResolvePath(target)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	if err := os.MkdirAll(filepath.Dir(fullTarget), os.ModePerm); err != nil {
		return IOResult{false, err.Error()}
	}

	if err := os.Rename(fullSource, fullTarget); err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) RemoveFile(path string) IOResult {
	log.Printf("RemoveFile: %s", path)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	if err := os.RemoveAll(fullPath); err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) CopyFile(src string, dst string) IOResult {
	log.Printf("CopyFile: %s -> %s", src, dst)

	srcPath, err := utils.ResolvePath(src)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	dstPath, err := utils.ResolvePath(dst)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	srcFile, err := os.Open(srcPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer srcFile.Close()

	if err := os.MkdirAll(filepath.Dir(dstPath), os.ModePerm); err != nil {
		return IOResult{false, err.Error()}
	}

	dstFile, err := os.Create(dstPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) MakeDir(path string) IOResult {
	log.Printf("MakeDir: %s", path)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	if err := os.MkdirAll(fullPath, os.ModePerm); err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) ReadDir(path string) IOResult {
	log.Printf("ReadDir: %s", path)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	files, err := os.ReadDir(fullPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	var result []string

	for _, file := range files {
		if info, err := file.Info(); err == nil {
			result = append(result, fmt.Sprintf("%v,%v,%v", info.Name(), info.Size(), info.IsDir()))
		}
	}

	return IOResult{true, strings.Join(result, "|")}
}

func (a *IoService) OpenDir(path string) IOResult {
	log.Printf("OpenDir: %s", path)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	err = browser.OpenURL(fullPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) OpenURI(uri string) IOResult {
	log.Printf("OpenURI: %s", uri)

	err := browser.OpenURL(uri)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) AbsolutePath(path string) IOResult {
	log.Printf("AbsolutePath: %s", path)

	absPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, absPath}
}

func (a *IoService) UnzipZIPFile(path string, output string) IOResult {
	log.Printf("UnzipZIPFile: %s -> %s", path, output)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	outputPath, err := utils.ResolvePath(output)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	archive, err := zip.OpenReader(fullPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer archive.Close()

	cleanOutputPath := outputPath + "/"

	for _, f := range archive.File {
		filePath := filepath.ToSlash(filepath.Clean(filepath.Join(outputPath, f.Name)))

		if !strings.HasPrefix(filePath, cleanOutputPath) {
			continue
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(filePath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
			continue
		}

		fileInArchive, err := f.Open()
		if err != nil {
			continue
		}

		dstFile, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			fileInArchive.Close()
			continue
		}

		if _, err := io.Copy(dstFile, fileInArchive); err != nil {
			fileInArchive.Close()
			dstFile.Close()
			continue
		}

		fileInArchive.Close()
		dstFile.Close()
	}

	return IOResult{true, "Success"}
}

func (a *IoService) UnzipTarGZFile(path string, output string) IOResult {
	log.Printf("UnzipTarGZFile: %s -> %s", path, output)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	outputPath, err := utils.ResolvePath(output)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	gzipFile, err := os.Open(fullPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer gzipFile.Close()

	gzipReader, err := gzip.NewReader(gzipFile)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)

	cleanOutputPath := outputPath + "/"

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return IOResult{false, err.Error()}
		}

		filePath := filepath.ToSlash(filepath.Clean(filepath.Join(outputPath, header.Name)))

		if !strings.HasPrefix(filePath, cleanOutputPath) {
			continue
		}

		if header.Typeflag == tar.TypeDir {
			os.MkdirAll(filePath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
			continue
		}

		dstFile, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, header.FileInfo().Mode())
		if err != nil {
			continue
		}

		if _, err := io.Copy(dstFile, tarReader); err != nil {
			dstFile.Close()
			continue
		}

		dstFile.Close()
	}

	return IOResult{true, "Success"}
}

func (a *IoService) UnzipGZFile(path string, output string) IOResult {
	log.Printf("UnzipGZFile: %s -> %s", path, output)

	fullPath, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	outputPath, err := utils.ResolvePath(output)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	gzipFile, err := os.Open(fullPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer gzipFile.Close()

	outputFile, err := os.Create(outputPath)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer outputFile.Close()

	gzipReader, err := gzip.NewReader(gzipFile)
	if err != nil {
		return IOResult{false, err.Error()}
	}
	defer gzipReader.Close()

	if _, err := io.Copy(outputFile, gzipReader); err != nil {
		return IOResult{false, err.Error()}
	}

	return IOResult{true, "Success"}
}

func (a *IoService) FileExists(path string) IOResult {
	log.Printf("FileExists: %s", path)

	path, err := utils.ResolvePath(path)
	if err != nil {
		return IOResult{false, err.Error()}
	}

	_, err = os.Stat(path)
	if err == nil {
		return IOResult{true, "true"}
	}

	if os.IsNotExist(err) {
		return IOResult{true, "false"}
	}

	return IOResult{false, err.Error()}
}
