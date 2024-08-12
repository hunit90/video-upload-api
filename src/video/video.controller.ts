import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  Body, UploadedFiles
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { VideoService } from './video.service';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('file', 10, {  // 클라이언트 요청의 key 이름을 'file'로 변경
      storage: diskStorage({
        destination: './upload',
        filename: (req, file, callback) => {
          const uniqueId = uuidv4(); // UUID 생성
          const fileExt = extname(file.originalname);
          const fileName = `${uniqueId}${fileExt}`;
          callback(null, fileName);
        },
      }),
      fileFilter: (req, file, callback) => {
        const fileExt = extname(file.originalname);
        if (fileExt.match(/\.(avi|mp4|mov)$/)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('지원되지 않는 파일 형식입니다.'),
            false,
          );
        }
      },
    }),
  )
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('파일이 업로드되지 않았습니다.');
    }

    const uploadedFiles = files.map((file) => {
      const fileId = file.filename.split('.')[0]; // 파일명에서 ID 추출
      return {
        fileId: fileId, // 파일 ID 반환
        filePath: `/upload/${file.filename}`,
      };
    });

    return {
      message: '파일 업로드 성공',
      files: uploadedFiles,
    };
  }

  @Get('list')
  async getUploadedVideos() {
    return this.videoService.getUploadedVideos();
  }

  @Post('trim')
  async trimVideo(
    @Body('fileId') fileId: string,
    @Body('trim_start') trimStart: number,
    @Body('trim_end') trimEnd: number,
  ) {
    if (!fileId || trimStart === undefined || trimEnd === undefined) {
      throw new BadRequestException(
        'fileId, trimStart, trimEnd 값을 모두 제공해야 합니다.',
      );
    }

    const result = await this.videoService.trimVideo(
      fileId,
      trimStart,
      trimEnd,
    );

    return {
      message: '동영상 트리밍 성공',
      filePath: result.filePath,
      downloadUrl: result.downloadUrl,
    };
  }

  @Post('concat')
  async concatVideos(@Body('fileIds') fileIds: string[]) {
    if (!fileIds || fileIds.length < 2) {
      throw new BadRequestException(
        '최소 두 개의 동영상 파일 ID를 제공해야 합니다.',
      );
    }

    const result = await this.videoService.concatVideos(fileIds);

    return {
      message: '동영상 concat 성공',
      filePath: result.filePath,
      downloadUrl: result.downloadUrl,
    };
  }

  @Get('concat-list')
  async getConcatVideoList() {
    try {
      return await this.videoService.getConcatVideoList();
    } catch (error) {
      throw new BadRequestException(
        'concat된 동영상 목록을 불러오는 데 실패했습니다.',
      );
    }
  }

  @Get('trim-list')
  async getTrimVideoList() {
    try {
      return await this.videoService.getTrimVideoList();
    } catch (error) {
      throw new BadRequestException(
        'trim된 동영상 목록을 불러오는 데 실패했습니다.',
      );
    }
  }
}
