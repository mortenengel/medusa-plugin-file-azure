import { 
    AbstractFileService, 
    DeleteFileType, 
    FileServiceGetUploadStreamResult, 
    FileServiceUploadResult, 
    GetUploadedFileType, 
    UploadStreamDescriptorType, 
  } from "@medusajs/medusa"
  import {
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
  
    constructor({}, options) {
      super({}, options)
      console.log("AzureFileStorageService")
      console.log(options)
      var serviceClient = BlobServiceClient.fromConnectionString(options.connectionString)
      this.protectedClient_ = serviceClient.getContainerClient(options.protectedContainer)
      this.publicClient_ = serviceClient.getContainerClient(options.publicContainer)
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
      const protectedBlockClient = this.protectedClient_.getBlockBlobClient(file.fileKey)
      await protectedBlockClient.deleteIfExists()
      const publicBlockClient = this.publicClient_.getBlockBlobClient(file.fileKey)
      await publicBlockClient.deleteIfExists()
    }
  
    async getUploadStreamDescriptor(
      fileData: UploadStreamDescriptorType  & {
          usePrivateBucket?: boolean
          contentType?: string
        }
    ): Promise<FileServiceGetUploadStreamResult> {
      console.log(fileData)
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
      return blockClient.url
    }
  }
  
  export default AzureFileService