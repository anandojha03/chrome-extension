function adjustPopupSize() {
    const body = document.body;
    const html = document.documentElement;

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
      resultContainer.innerHTML = ""; // Clear previous content

      // Create a table element
      const table = document.createElement("table");
      table.classList.add("result-table");

      // Add a row for the status
      const statusRow = document.createElement("tr");
      const statusCell = document.createElement("td");
      statusCell.setAttribute("colspan", "4"); // Span across all columns
      statusCell.textContent = `Status: ${result.comparison_result.Status}`;
      statusCell.style.fontWeight = "bold";
      statusCell.style.textAlign = "center";
      statusCell.style.fontSize = "1.3em";
      statusRow.appendChild(statusCell);
      table.appendChild(statusRow);

      // Add table headers
      const headerRow = document.createElement("tr");
      const headers = ["Field", "Response 1", "Response 2", "Status"];
      headers.forEach(headerText => {
          const header = document.createElement("th");
          header.textContent = headerText;
          headerRow.appendChild(header);
      });
      table.appendChild(headerRow);

      // Add rows for mismatched fields
      if (result.comparison_result.mismatched_fields) {
          Object.entries(result.comparison_result.mismatched_fields).forEach(([key, value]) => {
              const row = document.createElement("tr");
              row.style.backgroundColor = "#fff0f0"; // Light red for mismatches

              const fieldCell = document.createElement("td");
              fieldCell.textContent = key;
              row.appendChild(fieldCell);

              const response1Cell = document.createElement("td");
              response1Cell.textContent = value[0] || "N/A";
              row.appendChild(response1Cell);

              const response2Cell = document.createElement("td");
              response2Cell.textContent = value[1] || "N/A";
              row.appendChild(response2Cell);

              const statusCell = document.createElement("td");
              statusCell.textContent = "mismatch";
              statusCell.style.color = "red";
              row.appendChild(statusCell);

              table.appendChild(row);
          });
      }

      // Add rows for matching fields
      if (result.comparison_result.matching_fields) {
          Object.entries(result.comparison_result.matching_fields).forEach(([key, value]) => {
              const row = document.createElement("tr");
              row.style.backgroundColor = "#f0fff0"; // Light green for matches

              const fieldCell = document.createElement("td");
              fieldCell.textContent = key;
              row.appendChild(fieldCell);

              const response1Cell = document.createElement("td");
              response1Cell.textContent = value[0] || "N/A";
              row.appendChild(response1Cell);

              const response2Cell = document.createElement("td");
              response2Cell.textContent = value[1] || "N/A";
              row.appendChild(response2Cell);

              const statusCell = document.createElement("td");
              statusCell.textContent = "match";
              statusCell.style.color = "green";
              row.appendChild(statusCell);

              table.appendChild(row);
          });
      }

      // Append the table to the result container
      resultContainer.appendChild(table);

      // Add a download button for the results
      const downloadBtn = document.createElement("button");
      downloadBtn.innerText = "Download Results";
      downloadBtn.classList.add("download-btn");
      downloadBtn.addEventListener("click", () => {
          downloadResults(result, "comparison_result.json");
      });
      resultContainer.appendChild(downloadBtn);
  }

  // Load captures from storage when the popup opens
  chrome.storage.local.get("captures", (data) => {
    const captures = data.captures || [];
    displayScreenshots(captures);
    if (captures.length >= 2) {
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
          if (captures.length >= 2) {
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