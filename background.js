chrome.runtime.onInstalled.addListener(() => {
    console.log("Capture & Compare extension installed.");
  });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "resizePopup") {
          chrome.windows.getCurrent((win) => {
              chrome.windows.update(win.id, {
                  width: message.width,
                  height: message.height,
              });
          });
      }
  });
