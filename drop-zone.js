
import React from 'react'

//package node module for browser
import pako from 'pako/dist/pako.min'

//imported by index.js
import FileManager from '../../../libs/file-manager'
import CookieStorage from '../../../libs/storage/cookie'
import ProgressBar from '../../lib/progress-bar'

import config from '../../../config'

import './drop-zone.css'

class DropZone extends React.Component{
  constructor( props ){
    super( props )

    this.container = null
    this.files = []

    //this.handleFileDropped      = this.handleFilesDropped.bind( this )
    this.handleFileReadComplete = this.handleFileReadComplete.bind( this )
    this.handleUploadProgress   = this.handleUploadProgress.bind( this )

    this.fileManager = new FileManager({
      'handlers': [
        {
          //pre-check
          'extensions': [ '.las' ],
          'kinds': [ 'file' ],
          'types': [ '' ],
  
          //post-check
          'names': [],
          'size': [ 0, 50000000 ], //50MB
  
          'format': 'buffer',
          'read': true
        }
      ]
    })
  }

  componentDidMount(){
    this.container = document.getElementById( 'drop-zone' )    

    this.registerHandlers()
  }

  fetchFilePoll( fileId ){
    const options = {
      'id': fileId,
      'interval': 1000,
      'timeout': 5000,
      'status': {
        '$ne': 'submitted'
      }
    }

    const url = `${config.baseUrl}/_rest/v1/file/find`
    const auth = CookieStorage.get( 'auth' )
    const req = new Request( url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    })

    return fetch( req )
      .then( res => {
        return Promise.all([ res, res.text() ])
      })
  }

  /*
  //extra validation
  handleFilesDropped( filesEvent ){
    if( filesEvent.cancelable )
      filesEvent.preventDefault()
  }
  */

  handleFileReadComplete( readCompleteEvent ){
    const file = readCompleteEvent.file
    this.files[ file.name ] = {
      'name': file.name,
      'size': file.size
    }
    this.handleUploadProgress( file, 0 )

    let fileData = {}
    this.zipFile( file, readCompleteEvent.reader.result )
      .then( zipData => this.uploadFile( file, zipData ) )
      .then( xhr => {
        console.info( 'Upload successful' )
        this.handleUploadProgress( file, 1 )
        fileData = JSON.parse( xhr.responseText )

        //should only be 1
        //const link = xhr.getResponseHeader( 'Link' )
        //const match = /^<([^>]+)>/.exec( link )
        return this.fetchFilePoll( fileData.fileId )
      })
      .then(([ res, body ]) => {
        if( res.status === 200 ){
          const files = JSON.parse( body ).filter( file => file )
          if( files.length ){
            const evt = new Event( 'files-changed', { 'bubbles': true, 'cancelable': false })
            this.container.dispatchEvent( evt )
          }
          else{
            console.warn( `The uploaded file hasn't completed yet: ${fileData.fileId}` )
          }
        }
        else{
          alert( 'unhandled' )
          debugger
        }
      })
      .catch( xhr => {
        console.error( 'Upload failed' )
        this.handleUploadProgress( file, -1 )
      })
  }

  handleUploadProgress( file, progress ){
    if( progress === -1 ){
      //TODO: error
    }
    else{
      this.files[ file.name ].progress = progress
      this.forceUpdate()
    }
  }

  registerHandlers(){
    //after drop
    //this.fileManager.off( 'dropped', this.handleFilesDropped )
    //this.fileManager.on(  'dropped', this.handleFilesDropped )

    //after processing
    this.fileManager.off( 'read_complete', this.handleFileReadComplete )
    this.fileManager.on(  'read_complete', this.handleFileReadComplete )
  }

  render(){
    const files = []
    for( let fileName of Object.keys( this.files ) ){
      let file = this.files[fileName]
      files.push(
        <ProgressBar key={file.name} progress={file.progress}>{file.name}</ProgressBar>
      )
    }

    return (
      <section id="drop-zone"
        onDrop={this.fileManager.handleDrop}
        onDragOver={this.fileManager.handleDragOver}
        onDragLeave={this.fileManager.handleDragLeave}>
          {this.props.children}
          {files}
        </section>
    )
  }

  //ref: RefinedAnalytics.js:300
  uploadFile( file, blobData ){
    return new Promise( (resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onabort = err => {
        debugger
        console.error( `${Date.now()}...upload cancelled: ${err}` )
        reject( xhr, err )
      }
      xhr.onerror = err => {
        console.error( `${Date.now()}...upload failed: ${err}` )
        reject( xhr, err )
      }
      xhr.onload = e => { //progress event
        if( 200 <= xhr.status && xhr.status < 400 ){
          console.log( `${Date.now()}...upload completed` )
          resolve( xhr )
        }
        else{
          console.error( `${Date.now()}...upload failed` )
          reject( xhr )
        }
      }
      xhr.upload.onprogress = e => { //progress event
        let progress = 0.5
        if( e.lengthComputable ){
          progress = e.loaded / e.total
        }
        this.handleUploadProgress( file, progress, xhr )
      }

      xhr.open('POST', `${config.baseUrl}/_rest/v1/file`)
      xhr.setRequestHeader('Accept', 'application/json')

      const authorization = CookieStorage.get( 'auth' )
      xhr.setRequestHeader('Authorization', `Bearer ${authorization}`)

      const formData = new FormData()
      formData.append('file', blobData, `${file.name}.gz` )
      formData.append('filename', file.name ) //adding multiple fields causes boundary
      xhr.send(formData)
      console.log( `${Date.now()}Started upload...` )
    })
  }

  zipFile( file, data ){
    return new Promise((resolve, reject)=>{
      try{
        console.log( `${Date.now()}Start deflate...` )
        const blob = new Blob([pako.gzip(data, { level: 7 })])
        console.log( `${Date.now()}...deflate completed` )
        resolve( blob )
      }
      catch( err ){
        reject( err )
      }
    })
  }
}

export default DropZone
