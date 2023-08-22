import { 
    AbstractFileService, 
    DeleteFileType, 
    FileServiceGetUploadStreamResult, 
    FileServiceUploadResult, 
    GetUploadedFileType, 
    UploadStreamDescriptorType, 
  } from "@medusajs/medusa"
  import {
    BlobGenerateSasUrlOptions,
      BlobSASPermissions,
      BlobServiceClient,
      ContainerClient
  } from "@azure/storage-blob"
  import {
      parse
  } from "path"
  import fs from "fs"
  import stream from "stream"
  import { Lifetime } from "awilix"
  
  class AzureFileService extends AbstractFileService {
    static LIFE_TIME = Lifetime.SINGLETON
    protectedClient_ : ContainerClient
    publicClient_ : ContainerClient
    sasOptionsBuilder_: () => BlobGenerateSasUrlOptions;
  
    constructor({}, options) {
      super({}, options)
      var serviceClient = BlobServiceClient.fromConnectionString(options.connectionString)
      this.protectedClient_ = serviceClient.getContainerClient(options.protectedContainer)
      this.publicClient_ = serviceClient.getContainerClient(options.publicContainer)
      this.sasOptionsBuilder_ = options.sasOptionsBuilder ?? this.defaultSasOptionsBuilder
    }
    
    async upload(
      file: Express.Multer.File
    ): Promise<FileServiceUploadResult> {
      return await this.uploadFile(file)
    }
  
    async uploadProtected(
      file: Express.Multer.File
    ): Promise<FileServiceUploadResult> {
      return await this.uploadFile(file, { isProtected: true })
    }
  
    private async uploadFile(
      file: Express.Multer.File,
      options: { isProtected: boolean } = { isProtected: false }
    ) {
      const parsedFilename = parse(file.originalname)
      const fileKey = options.isProtected ? `${parsedFilename.name}-${Date.now()}${parsedFilename.ext}` : `${parsedFilename.name}.${parsedFilename.ext}`
  
      const client = options.isProtected ? this.protectedClient_ : this.publicClient_
      var blockBlobClient = client.getBlockBlobClient(fileKey)
  
      const result = await blockBlobClient.uploadStream(fs.createReadStream(file.path))
  
      return { url: blockBlobClient.url, key: fileKey }
    }
  
    async delete(
      file: DeleteFileType
    ): Promise<void> {
      var fileKey = file.fileKey ?? file.file_key //for some reason it's sent as file_key. adding this to be ready for future bugfix
      try {
        const protectedBlockClient = this.protectedClient_.getBlockBlobClient(fileKey)
        await protectedBlockClient.deleteIfExists()
      } catch (ex) {
        console.log('failed deleting protected file: ' + ex)
      }
      try {
        const publicBlockClient = this.publicClient_.getBlockBlobClient(fileKey)
        await publicBlockClient.deleteIfExists()
      } catch (ex) {
        console.log('failed deleting public file: ' + ex)
      }
    }
  
    async getUploadStreamDescriptor(
      fileData: UploadStreamDescriptorType  & {
          usePrivateBucket?: boolean
          contentType?: string
        }
    ): Promise<FileServiceGetUploadStreamResult> {
      const usePrivateBucket = fileData.usePrivateBucket ?? true
  
      const client = usePrivateBucket ? this.protectedClient_ : this.publicClient_
      const fileKey = `${fileData.name}.${fileData.ext}`
      const blockClient = client.getBlockBlobClient(fileKey)
      const pass = new stream.PassThrough()
      
      return {
        writeStream: pass,
        promise: blockClient.uploadStream(pass),
        url: blockClient.url,
        fileKey,
      }
    }
  
    async getDownloadStream(
      fileData: GetUploadedFileType & { usePrivateBucket?: boolean }
    ): Promise<NodeJS.ReadableStream> {
      const usePrivateBucket = fileData.usePrivateBucket ?? true
      const client = usePrivateBucket ? this.protectedClient_ : this.publicClient_
      const blockClient = client.getBlockBlobClient(fileData.fileKey)
      const downloadResponse = await blockClient.download();
      return downloadResponse.readableStreamBody as NodeJS.ReadableStream
    }
  
    async getPresignedDownloadUrl(
      { usePrivateBucket = true, ...fileData }
    ): Promise<string> {
      const client = usePrivateBucket ? this.protectedClient_ : this.publicClient_
      const blockClient = client.getBlockBlobClient(fileData.fileKey)
      return usePrivateBucket ? await blockClient.generateSasUrl(this.sasOptionsBuilder_()) : blockClient.url
    }

    private defaultSasOptionsBuilder() : BlobGenerateSasUrlOptions {
      var now = new Date();
      return { 
        permissions: BlobSASPermissions.from({ read: true }),
        expiresOn: new Date(now.getFullYear(), now.getMonth(), now.getDate()+30)
      }
    }
  }
  
  export default AzureFileService