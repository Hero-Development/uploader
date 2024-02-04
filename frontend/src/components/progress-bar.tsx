
const ProgressBar = (props: any) => {
  const render = () => {
    const progess = {
      'opacity': props.progress,
      'width': Math.round(props.progress * 100) +'%'
    }

    return (
      <div className="progress-bar">
        <div className="progress" style={progess}></div>
        <label>{props.children}</label>
      </div>
    )
  }

  return render();
}

export default ProgressBar
