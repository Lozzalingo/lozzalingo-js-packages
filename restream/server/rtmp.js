const NodeMediaServer = require('node-media-server');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  logType: 3, // errors only
};

function createRtmpServer(onPublish, onUnpublish) {
  const nms = new NodeMediaServer(config);

  nms.on('prePublish', (id, StreamPath) => {
    console.log(`[RTMP] Stream published: ${StreamPath}`);
    onPublish(id, StreamPath);
  });

  nms.on('donePublish', (id, StreamPath) => {
    console.log(`[RTMP] Stream ended: ${StreamPath}`);
    onUnpublish(id, StreamPath);
  });

  return nms;
}

module.exports = createRtmpServer;
