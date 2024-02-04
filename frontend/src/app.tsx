import {useState} from "preact/hooks";
import ProgressBar from "./components/progress-bar";


type DataTransferFile = DataTransferItem & File;


type FileEvent = Event & {
  file: DataTransferFile
};

type FileSummary = {
  name: string;
  size: number;
  progress: number;
};

type Handler = {
  format: string;
  read: boolean;
  kinds: string[];
  types: string[];
};

const settings = {
  handlers: [
    {
      format: 'binary',
      read: true,
      kinds: [
        'file'
      ],
      types: [
        'image/png'
      ],
    }
  ]
};


const App = () => {
  const [files, setFiles] = useState<FileSummary[]>([]);

  const canDragDropFiles = () => {
    return !!(window.File && window.FileList && window.FileReader);
  };

  const getHandler = (file: DataTransferItem): Handler | null => {
    let handler, kindMatch, typeMatch;
    const handlers = settings.handlers;
    for (handler of handlers) {
      kindMatch = false;
      typeMatch = false;
  
      // check kind
      if ('kinds' in handler && 'kind' in file) {
        if (handler.kinds.indexOf(file.kind) > -1) {
          kindMatch = true;
        }
      }
      else{
        kindMatch = true;
      }
  
      // check type
      if ('types' in handler && 'type' in file) {
        if (handler.types.indexOf(file.type) > -1) {
          typeMatch = true;
        }
      }
      else{
        typeMatch = true;
      }
  
  
      if (kindMatch && typeMatch)
        return handler;
    }
  
    return null;
  };

  const handleDragOver = (evt: DragEvent) => {
    if( evt.cancelable )
      evt.preventDefault();
  
    evt.stopPropagation();
  
    if (evt.dataTransfer && evt.target) {
      const items = [].slice.call(evt.dataTransfer.items);
      if (items.some(getHandler)) {
        // pass
        const target = evt.target as HTMLElement;
        target.classList.add('drag-over');
        evt.dataTransfer.dropEffect = 'copy';
      }
      else{
        // fail
        evt.dataTransfer.dropEffect = 'none';
      }
    }
  };

  const handleDragLeave = (evt: DragEvent) => {
    const target = evt.target as HTMLElement;
    target.classList.remove('drag-over');
  }

  const handleDrop = (dragEvent: DragEvent) => {
    if (dragEvent.cancelable)
      dragEvent.preventDefault();
  
    dragEvent.stopPropagation();
  
    //undo any effects of onDragEnter
    handleDragLeave(dragEvent);
  
    let files: Array<DataTransferFile> = [];
    try{
      if (dragEvent.dataTransfer?.files)
        files = files.slice.call(dragEvent.dataTransfer.files);
    }
    catch(_){}
  
    const droppedEvent = onDropped(dragEvent, files);
    if (!droppedEvent.defaultPrevented) {
      let file, handler;
      for (file of files) {
        handler = getHandler(file);
        if (handler && handler.read) {
          readFile(file, handler);
        }
      }
    }
  };

  const handleFileReadComplete = async (readCompleteEvent: FileEvent) => {
    const newFile = {
      name: readCompleteEvent.file.name,
      size: readCompleteEvent.file.size,
      progress: 0
    };

    setFiles((prevFiles) => {
      if (prevFiles) {
        return [
          ...prevFiles,
          newFile
        ];
      }
      else {
        return [newFile];
      }
    });

    handleUploadProgress(newFile, 0);

    try{
      const xhr = await uploadFile(newFile, readCompleteEvent.file);
      console.info('Upload successful');
      handleUploadProgress(newFile, 1);
    }
    catch (err) {
      console.error('Upload failed');
      handleUploadProgress(newFile, -1 );
    }
  }

  const handleUploadProgress = (file: FileSummary, progress: number) => {
    if (progress === -1) {
      //TODO: error
      debugger;
    }
    else{
      setFiles((prevFiles) => {
        const newFiles = [];
        for (const prev of prevFiles) {
          if (prev.name === file.name) {
            newFiles.push({
              ...prev,
              progress
            });
          }
          else{
            newFiles.push(prev);
          }
        }

        return newFiles;
      });
    }
  };


  const onDropped = (dragEvent: DragEvent, files: DataTransferItem[]) => {
    const target = dragEvent.target as HTMLElement;

    const filesEvent: any = new Event('dropped', {cancelable: true});
    filesEvent.files = files;
      
    target.dispatchEvent(filesEvent);
    // this.emit('dropped', filesEvent);

    return filesEvent;
  };

  const onReadComplete = (file: DataTransferItem, progressEvent: ProgressEvent) => {
    const target = progressEvent.target as FileReader;

    const readCompleteEvent: any = new Event('read_complete');
    readCompleteEvent.file = file;
    readCompleteEvent.reader = {
      result: target.result
    };

    target.dispatchEvent(readCompleteEvent);
    // this.emit('read_complete', readCompleteEvent);

    handleFileReadComplete(readCompleteEvent);
    return readCompleteEvent;
  };

  const readFile = (file: DataTransferFile, handler: Handler) => {
    console.log(file.name);
  
    const reader = new FileReader();
    reader.onload = onReadComplete.bind(null, file);
  
    switch (handler.format) {
      case 'binary':
        return reader.readAsBinaryString(file);
  
      case 'buffer':
        return reader.readAsArrayBuffer(file);
  
      case 'dataurl':
        return reader.readAsDataURL(file);
  
      default:
        return reader.readAsText(file);
    }
  };

  const uploadFile = (file: FileSummary, blobData: Blob) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onabort = (err: any) => {
        console.error(`${Date.now()}...upload cancelled: ${err}`);

        err.xhr = xhr;
        reject(err);
      }
      xhr.onerror = (err: any) => {
        console.error(`${Date.now()}...upload failed: ${err}`);

        err.xhr = xhr;
        reject(err);
      }
      xhr.onload = (evt: Event) => { //progress event
        if (200 <= xhr.status && xhr.status < 400){
          console.log(`${Date.now()}: ...upload completed`);
          resolve(xhr);
        }
        else{
          console.error(`${Date.now()}: ...upload failed`);
          reject(xhr);
        }
      }
      xhr.upload.onprogress = e => { //progress event
        let progress = 0.5;
        if (e.lengthComputable) {
          progress = e.loaded / e.total;
        }
        console.log();
        handleUploadProgress(file, progress);
      }

      xhr.open('POST', `http://localhost:8000/upload`);
      // xhr.setRequestHeader('Accept', 'application/json');

      const formData = new FormData();
      formData.append('file', blobData, file.name);
      formData.append('filename', file.name); //adding multiple fields causes boundary

      xhr.send(formData);
      console.log(`${Date.now()}: Started upload...`);
    })
  }







  const render = () => {
    if (canDragDropFiles()) {
      const files: any[] = [];
      for (let file of files) {
        files.push(
          <ProgressBar key={file.name} progress={file.progress}>{file.name}</ProgressBar>
        )
      }


      return (
        <main>
          <h1>Hello World!</h1>
          <section id="drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}>
              Drop Zone
              {files}
          </section>
        </main>
      );
    }
    else {
      <main>
        <h1>Hello World!</h1>
        <p>File operations are not supported by this browser</p>
      </main>
    }
  };

  return render();
};

export { App };
