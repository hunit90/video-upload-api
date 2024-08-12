import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import { readdir } from 'fs/promises';
import { join } from 'path';
import * as fs from 'fs';

@Injectable()
export class VideoService {
  private readonly uploadDir = join(__dirname, '..', '..', 'upload');
  private readonly concatDir = join(__dirname, '..', '..', 'upload', 'concat');
  private readonly trimDir = join(__dirname, '..', '..', 'upload', 'trim');

  async getUploadedVideos() {
    try {
      const files = await readdir(this.uploadDir);
      const videoFiles = files.filter((file) => file.match(/\.(avi|mp4|mov)$/));

      return videoFiles.map((file) => ({
        fileId: file.split('.')[0], // 파일명에서 ID 추출
        fileName: file,
        filePath: `/upload/${file}`,
      }));
    } catch (error) {
      throw new BadRequestException('파일 목록을 불러오는 데 실패했습니다.');
    }
  }

  async getConcatVideoList(): Promise<
    { fileId: string; fileName: string; filePath: string }[]
  > {
    try {
      const files = await readdir(this.concatDir);
      const videoFiles = files.filter((file) => file.match(/\.(avi|mp4|mov)$/));

      return videoFiles.map((file) => ({
        fileId: file.split('.')[0], // 파일명에서 ID 추출
        fileName: file,
        filePath: `/upload/concat/${file}`,
      }));
    } catch (error) {
      throw new BadRequestException(
        'concat된 동영상 목록을 불러오는 데 실패했습니다.',
      );
    }
  }

  async trimVideo(
    fileId: string,
    trimStart: number,
    trimEnd: number,
  ): Promise<{ filePath: string; downloadUrl: string }> {
    const uploadDir = join(__dirname, '..', '..', 'upload');
    const trimDir = join(uploadDir, 'trim');
    const inputFilePath = join(uploadDir, `${fileId}.mp4`);
    const tempOutputFilePath = join(uploadDir, `${fileId}_trimmed.mp4`);
    const finalOutputFilePath = join(
      trimDir,
      `${fileId}_trimmed_${Date.now()}.mp4`,
    );

    // Ensure the trim directory exists
    if (!fs.existsSync(trimDir)) {
      fs.mkdirSync(trimDir, { recursive: true });
    }

    // Check if the input file exists
    if (!fs.existsSync(inputFilePath)) {
      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputFilePath)
        .setStartTime(trimStart)
        .setDuration(trimEnd - trimStart)
        .output(tempOutputFilePath)
        .on('end', () => {
          // Move the trimmed file to the trim directory
          fs.rename(tempOutputFilePath, finalOutputFilePath, (err) => {
            if (err) {
              return reject(
                new BadRequestException('파일 이동에 실패했습니다.'),
              );
            }

            const downloadUrl = `/upload/trim/${finalOutputFilePath.split('/').pop()}`;
            resolve({ filePath: finalOutputFilePath, downloadUrl });
          });
        })
        .on('error', (err) => {
          reject(new BadRequestException('동영상 트리밍에 실패했습니다.'));
        })
        .run();
    });
  }

  async concatVideos(
    fileIds: string[],
  ): Promise<{ filePath: string; downloadUrl: string }> {
    const uploadDir = join(__dirname, '..', '..', 'upload');
    const concatDir = join(uploadDir, 'concat');

    // Ensure the concat directory exists
    if (!fs.existsSync(concatDir)) {
      fs.mkdirSync(concatDir, { recursive: true });
    }

    const tempOutputFilePath = join(uploadDir, `temp_concat_${Date.now()}.mp4`);
    const finalOutputFilePath = join(
      concatDir,
      `concatenated_${Date.now()}.mp4`,
    );

    const inputFilePaths = fileIds.map((fileId) => {
      const filePath = join(uploadDir, `${fileId}.mp4`);
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException(`파일을 찾을 수 없습니다: ${fileId}`);
      }
      return filePath;
    });

    return new Promise((resolve, reject) => {
      const ffmpegCommand = ffmpeg();

      inputFilePaths.forEach((filePath) => {
        ffmpegCommand.input(filePath);
      });

      ffmpegCommand
        .on('end', () => {
          // Move the file to the concat directory
          fs.rename(tempOutputFilePath, finalOutputFilePath, (err) => {
            if (err) {
              return reject(
                new BadRequestException('파일 이동에 실패했습니다.'),
              );
            }

            const downloadUrl = `/upload/concat/${finalOutputFilePath.split('/').pop()}`;
            resolve({ filePath: finalOutputFilePath, downloadUrl });
          });
        })
        .on('error', (err) => {
          reject(new BadRequestException('동영상 concat에 실패했습니다.'));
        })
        .mergeToFile(tempOutputFilePath, uploadDir);
    });
  }

  async getTrimVideoList(): Promise<
    { fileId: string; fileName: string; filePath: string }[]
  > {
    try {
      const files = await readdir(this.trimDir);
      const videoFiles = files.filter((file) => file.match(/\.(avi|mp4|mov)$/));

      return videoFiles.map((file) => ({
        fileId: file.split('.')[0], // 파일명에서 ID 추출
        fileName: file,
        filePath: `/upload/trim/${file}`,
      }));
    } catch (error) {
      throw new BadRequestException(
        'trim된 동영상 목록을 불러오는 데 실패했습니다.',
      );
    }
  }
}
