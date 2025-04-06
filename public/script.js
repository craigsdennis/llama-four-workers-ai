document.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const imagePreview = document.getElementById('image-preview');
  const promptInput = document.getElementById('prompt');
  const submitBtn = document.getElementById('submit-btn');
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  
  let imageBase64 = null;
  
  // Handle click on drop area
  dropArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Handle file selection
  fileInput.addEventListener('change', handleFile);
  
  // Handle drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
      dropArea.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
      dropArea.classList.remove('dragover');
    }, false);
  });
  
  dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    handleFile({ target: { files: [file] }});
  }, false);
  
  // Process the selected file
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file || !file.type.match('image.*')) return;
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      imageBase64 = event.target.result; // Keep the full data URL
      imagePreview.src = event.target.result;
      imagePreview.style.display = 'block';
      toggleSubmitButton();
    };
    
    reader.readAsDataURL(file);
  }
  
  // Enable submit button when both image and prompt are provided
  promptInput.addEventListener('input', toggleSubmitButton);
  
  function toggleSubmitButton() {
    submitBtn.disabled = !imageBase64 || !promptInput.value.trim();
  }
  
  // Handle form submission
  submitBtn.addEventListener('click', async () => {
    if (!imageBase64 || !promptInput.value.trim()) return;
    
    // Show loading state
    submitBtn.disabled = true;
    loading.style.display = 'block';
    result.textContent = '';
    result.style.display = 'block';
    
    try {
      const response = await fetch('/understand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptInput.value.trim(),
          imageUrl: imageBase64
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode and append the chunk to the result
        const text = decoder.decode(value, { stream: true });
        result.textContent += text;
        
        // Auto-scroll to the bottom as new content arrives
        result.scrollTop = result.scrollHeight;
      }
      
    } catch (error) {
      console.error('Error:', error);
      result.textContent = `Error: ${error.message}`;
    } finally {
      // Hide loading spinner when stream is complete
      loading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
});