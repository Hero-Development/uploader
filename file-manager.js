
const EventEmitter = require( 'events' )
const util = require( 'util' )

function FileManager( settings ){
	this.settings = settings

	if( FileManager.canDragDropFiles() ){
		this.handleDragLeave = this.handleDragLeave.bind( this )
		this.handleDragOver  = this.handleDragOver.bind( this )
		this.handleDrop      = this.handleDrop.bind( this )
	}
	else
		throw new Error( "File operations are not supported by this browser" )
}

util.inherits( FileManager, EventEmitter )

FileManager.canDragDropFiles = function(){
	if( window.File && window.FileList && window.FileReader ){
		return true
	}
	else{
		return false
	}
}

FileManager.prototype.getHandler = function( file ){
	let handler, kindMatch, typeMatch
	const handlers = this.settings.handlers
	for( handler of handlers ){
		kindMatch = false
		typeMatch = false

		// check kind
		if( 'kinds' in handler && 'kind' in file ){
			if( handler.kinds.indexOf( file.kind ) > -1 ){
				kindMatch = true
			}
		}
		else{
			kindMatch = true
		}


		// check type
		if( 'types' in handler && 'type' in file ){
			if( handler.types.indexOf( file.type ) > -1 ){
				typeMatch = true
			}
		}
		else{
			typeMatch = true
		}


		if( kindMatch && typeMatch )
			return handler
	}

	return false
}

FileManager.prototype.handleDragLeave = function( e ){
	e.target.classList.remove( 'drag-over' )
}

FileManager.prototype.handleDragOver = function( e ){
	if( e.cancelable )
		e.preventDefault()

	e.stopPropagation()

	const items = [].slice.call( e.dataTransfer.items )
	if( items.some( this.getHandler.bind( this ) ) ){
		// pass
		e.target.classList.add( 'drag-over' )
		e.dataTransfer.dropEffect = 'copy'
	}
	else{
		// fail
		e.dataTransfer.dropEffect = 'none'
	}
}

FileManager.prototype.handleDrop = function( dragEvent ){
	if( dragEvent.cancelable )
		dragEvent.preventDefault()

	dragEvent.stopPropagation()

	//undo any effects of onDragEnter
	this.handleDragLeave( dragEvent )


	let files = []
	try{
		files = files.slice.call( dragEvent.dataTransfer.files )
	}
	catch( _ ){}

	const droppedEvent = this.onDropped( dragEvent, files )
	if( !droppedEvent.defaultPrevented ){
		let file, handler
		for( file of files ){
			handler = this.getHandler( file )
			if( handler.read ){
				this.readFile( file, handler )
			}
		}
	}
}

FileManager.prototype.onDropped = function( dragEvent, files ){
	const filesEvent = new Event( 'dropped', { cancelable: true })
	filesEvent.files = files

	//const tmp = dragEvent.target.dispatchEvent( filesEvent )
	this.emit( 'dropped', filesEvent )
	return filesEvent
}

FileManager.prototype.onReadComplete = function( file, progressEvent ){
	const readCompleteEvent = new Event( 'read_complete' )
	readCompleteEvent.file = file
	readCompleteEvent.reader = {
		result: progressEvent.target.result
	}

	//const tmp = progressEvent.target.dispatchEvent( readCompleteEvent )
	this.emit( 'read_complete', readCompleteEvent )
	return readCompleteEvent
}

FileManager.prototype.readFile = function( file, handler ){
	console.log( file.name )

	const reader = new FileReader()
	reader.onload = this.onReadComplete.bind( this, file )

	switch( handler.format ){
		case 'binary':
			return reader.readAsBinaryString( file )

		case 'buffer':
			return reader.readAsArrayBuffer( file )

		case 'dataurl':
			return reader.readAsDataURL( file )

		default:
			return reader.readAsText( file )
	}
}

export default FileManager
