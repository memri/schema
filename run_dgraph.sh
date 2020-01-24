#!/usr/bin/env bash
tmux_session_name="memri_dgraph"
export_name=$1
dgraph_dir=$HOME"/.dgraph"

function startdgraph {
  printf $(pwd) > "$dgraph_dir/currentRunning"
  tmux new-session -d -s $tmux_session_name \; \
  send-keys 'dgraph zero' C-m \; \
  split-window -h \; \
  send-keys 'dgraph alpha --lru_mb 2048 --zero localhost:5080' C-m \; \
  split-window -v \; \
  send-keys 'dgraph-ratel' C-m \; \
  split-window -v \; \
  send-keys 'conda deactivate' C-m \; \
  send-keys 'conda activate memri-demo' C-m \;
}

# If no export name specified
if [ -z "$export_name" ]
then
  aws s3 ls memri-demo/dgraph/
  read -r -p "No graphDB specified, create new? [y/n] " response
  case "$response" in
      [yY][eE][sS]|[yY])
          echo "Creating new database"
          d=`date +"%Y-%m-%d-%T"`
          d="${d//:/-}"
          mkdir -p ~/.dgraph/memri_dgraph_$d
          cd ~/.dgraph/memri_dgraph_$d
          printf "~/.dgraph/memri_dgraph_$d" > "$dgraph_dir/currentRunning"
          startdgraph
          tmux a -t $tmux_session_name
          ;;
      *)
          echo "Exiting"
          ;;
  esac

# If name: see if exists: -> run, if not see if exists on s3, download->import->run, if not -> abort
else
  # directories
  dest="$dgraph_dir/$export_name"
  file1="g01.rdf.gz"
  file2="g01.schema.gz"

  mkdir -p $dest
  cd $dest

  if [ -d "$dest/p" ]
  then
    echo "already exists, starting"
    startdgraph
    tmux a -t $tmux_session_name
  else
    # download
    aws s3 cp "s3://memri-demo/dgraph/$export_name/$file1" "$dest/$file1"
    aws s3 cp "s3://memri-demo/dgraph/$export_name/$file2" "$dest/$file2"

    if [ -f "$dest/$file1" ]
    then
      startdgraph
      sleep 7
      tmux send-keys -t $tmux_session_name "dgraph live -f $file1 -s $file2" C-m
      tmux a -t $tmux_session_name
    else
      echo "Dgraph with name '$export_name' does not exist locally and does not exist on s3. For a new graph run without args"
    fi
  fi
fi
