function adjustPopupSize() {
    const body = document.body;
    const html = document.documentElement;

    document.getElementsByClassName("container")[0].style.width = "400px";

    const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
    );

    const width = Math.max(
        body.scrollWidth,
        body.offsetWidth,
        html.clientWidth,
        html.scrollWidth,
        html.offsetWidth
    );

    // Set a minimum and maximum size to avoid oversized windows
    const popupWidth = Math.min(Math.max(width, 400), 800); // Min 400px, Max 800px
    const popupHeight = Math.min(Math.max(height, 300), 1000); // Min 300px, Max 1000px

    chrome.runtime.sendMessage({
        action: "resizePopup",
        width: popupWidth,
        height: popupHeight,
    });
}

// Call adjustPopupSize whenever content changes
document.addEventListener("DOMContentLoaded", adjustPopupSize);
document.getElementById("compare-btn").addEventListener("click", adjustPopupSize);
document.getElementById("clear-btn").addEventListener("click", adjustPopupSize);


// Function to display captured screenshots as thumbnails
function displayScreenshots(captures) {
    const container = document.getElementById("screenshots-container");
    container.innerHTML = ""; // Clear previous content

    captures.forEach((data, index) => {
      const screenshotItem = document.createElement("div");
      screenshotItem.classList.add("screenshot-item");

      const thumbnail = document.createElement("img");
      thumbnail.src = `data:image/png;base64,${data}`;
      thumbnail.alt = `Screenshot ${index + 1}`;
      thumbnail.classList.add("thumbnail");

      const fullImage = document.createElement("img");
      fullImage.src = `data:image/png;base64,${data}`;
      fullImage.alt = `Screenshot ${index + 1}`;
      fullImage.classList.add("full-image");

      thumbnail.addEventListener("click", () => {
        fullImage.style.display = fullImage.style.display === "none" ? "block" : "none";
      });

      const downloadBtn = document.createElement("button");
      downloadBtn.innerText = `Download Screenshot ${index + 1}`;
      downloadBtn.classList.add("download-btn");
      downloadBtn.addEventListener("click", () => {
        downloadImage(data, `screenshot_${index + 1}.png`);
      });

      screenshotItem.appendChild(thumbnail);
      screenshotItem.appendChild(fullImage);
      screenshotItem.appendChild(downloadBtn);
      container.appendChild(screenshotItem);
    });
  }

  // Function to download an image
  function downloadImage(base64Data, filename) {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = filename;
    link.click();
  }

  // Function to download comparison results as a JSON file
  function downloadResults(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

//  Function to display comparison results in a table
function displayComparisonResults(result) {
  const resultContainer = document.getElementById("result");
  resultContainer.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("result-table");

  // Add status row
  const statusRow = document.createElement("tr");
  const statusCell = document.createElement("td");
  statusCell.setAttribute("colspan", "5");
  statusCell.textContent = `Status: ${result.comparison_result.status}`;  // Changed from Status to status
  statusCell.style.fontWeight = "bold";
  statusCell.style.textAlign = "center";
  statusCell.style.fontSize = "1.3em";
  statusRow.appendChild(statusCell);
  table.appendChild(statusRow);

  // Add headers
  const headerRow = document.createElement("tr");
  const headers = ["Field", "Desna", "TNA", "AusPayNet", "Status"];
  headers.forEach(headerText => {
      const header = document.createElement("th");
      header.textContent = headerText;
      header.style.fontWeight = "bold";
      headerRow.appendChild(header);
  });
  table.appendChild(headerRow);

  // Get all unique fields from both matching and mismatched fields
  const allFields = new Set([
      ...Object.keys(result.comparison_result.mismatched_fields || {}),
      ...Object.keys(result.comparison_result.matching_fields || {})
  ]);

  // Add rows for all fields
  allFields.forEach(field => {
      const row = document.createElement("tr");
      const isMatch = field in (result.comparison_result.matching_fields || {});
      row.style.backgroundColor = isMatch ? "#f0fff0" : "#fff0f0";

      // Add field name
      const fieldCell = document.createElement("td");
      fieldCell.textContent = field;
      row.appendChild(fieldCell);

      // Add values from each response
      const responses = [result.response1, result.response2, result.response3];
      responses.forEach(response => {
          const cell = document.createElement("td");
          cell.textContent = response[field] || "N/A";
          row.appendChild(cell);
      });

      // Add status
      const statusCell = document.createElement("td");
      statusCell.textContent = isMatch ? "match" : "mismatch";
      statusCell.style.color = isMatch ? "#2c853c" : "#c20000";
      row.appendChild(statusCell);

      table.appendChild(row);
  });

  resultContainer.appendChild(table);

  // Add download button
  const downloadBtn = document.createElement("button");
  downloadBtn.innerText = "Download Results";
  downloadBtn.classList.add("download-btn");
  downloadBtn.addEventListener("click", () => {
      downloadResults(result, "comparison_result.json");
  });
  resultContainer.appendChild(downloadBtn);

  document.getElementsByClassName("container")[0].style.width = "700px";
}


  // Load captures from storage when the popup opens
  chrome.storage.local.get("captures", (data) => {
    const captures = data.captures || [];
    displayScreenshots(captures);
    if (captures.length >= 3) {
      document.getElementById("compare-btn").disabled = false;
    }
  });

  document.getElementById("capture-btn").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.debugger.attach({ tabId: tab.id }, "1.3");

      const result = await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: true }
      );

      await chrome.debugger.detach({ tabId: tab.id });

      chrome.storage.local.get("captures", (data) => {
        const captures = data.captures || [];
        captures.push(result.data);
        chrome.storage.local.set({ captures }, () => {
          if (captures.length >= 3) {
            document.getElementById("compare-btn").disabled = false;
          }
          console.log("Full-page capture saved:", result.data);
          displayScreenshots(captures);
        });
      });
    } catch (error) {
      console.error("Failed to capture full page:", error);
      alert("Failed to capture the page. Please try again.");
    }
  });

  document.getElementById("compare-btn").addEventListener("click", async () => {
    chrome.storage.local.get("captures", async (data) => {
      const captures = data.captures || [];
      if (captures.length < 2) {
        alert("At least two captures are required for comparison.");
        return;
      }

      document.getElementById("loading").classList.remove("hidden");
      document.getElementById("compare-btn").disabled = true;

      try {
        const response = await fetch("http://127.0.0.1:8000/compare_documents/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ captures }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch comparison result.");
        }

        const result = await response.json();
        displayComparisonResults(result);
      } catch (error) {
        console.error("Error during comparison:", error);
        document.getElementById("result").innerText = "Error: " + error.message;
      } finally {
        document.getElementById("loading").classList.add("hidden");
        document.getElementById("compare-btn").disabled = false;
      }
    });
  });
  
  document.getElementById("clear-btn").addEventListener("click", () => {
    chrome.storage.local.set({ captures: [] }, () => {
      document.getElementById("compare-btn").disabled = true;
      document.getElementById("screenshots-container").innerHTML = "";
      document.getElementById("result").innerText = "";
      console.log("Captures cleared.");
    });
  });

