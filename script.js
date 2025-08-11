// Global variables
let cards = JSON.parse(localStorage.getItem('bubbleBoardCards')) || [];
let currentCardId = null;
let searchQuery = '';
let reminderTimeouts = {};
let undoStack = [];
let redoStack = [];
let selectedCards = new Set();
let isSelectionMode = false;
let currentTags = [];
let detailTags = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadCards();
    updateCardCounts();
    setupEventListeners();
    checkReminders();
    setInterval(checkReminders, 60000); // Check reminders every minute
    loadTheme();
    initializeParticleSystem();
});

// Setup event listeners
function setupEventListeners() {
    // Add card form submission
    document.getElementById('addCardForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addNewCard();
    });

    // Search input event
    document.getElementById('searchInput').addEventListener('input', function(e) {
        searchQuery = e.target.value.toLowerCase();
        searchTasks();
    });

    // Tag input events
    document.getElementById('tagInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = e.target.value.trim();
            if (tag) {
                addTag(tag);
                e.target.value = '';
            }
        }
    });

    document.getElementById('detailTagInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = e.target.value.trim();
            if (tag) {
                addDetailTag(tag);
                e.target.value = '';
            }
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
            closeDetailModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            showAddCardModal();
        }
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undoAction();
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redoAction();
        }
        if (e.key === 'Escape') {
            closeModal();
            closeDetailModal();
            if (isSelectionMode) {
                toggleSelectionMode();
            }
        }
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    });
}

// Card management functions
function addNewCard() {
    const title = document.getElementById('cardTitle').value.trim();
    const description = document.getElementById('cardDescription').value.trim();
    const priority = document.getElementById('cardPriority').value;
    const column = document.getElementById('cardColumn').value;
    const dueDate = document.getElementById('cardDueDate').value;
    const reminder = document.getElementById('cardReminder').value;

    if (!title) {
        alert('Please enter a title for the card');
        return;
    }

    const card = {
        id: Date.now().toString(),
        title: title,
        description: description,
        priority: priority,
        column: column,
        dueDate: dueDate,
        reminder: reminder,
        tags: [...currentTags],
        subtasks: window.tempSubtasks || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    saveToUndoStack();
    cards.push(card);
    saveCards();
    renderCard(card);
    updateCardCounts();
    setupReminder(card);
    closeModal();
    resetForm();
    updateUndoRedoButtons();
}

function renderCard(card) {
    const column = document.getElementById(card.column);
    if (!column) {
        console.error('Column not found for:', card.column);
        return;
    }

    const cardElement = document.createElement('div');
    cardElement.className = `card priority-${card.priority}`;
    cardElement.draggable = true;
    cardElement.dataset.cardId = card.id;

    const dueDateText = card.dueDate ? formatDueDate(card.dueDate) : '';
    const dueDateClass = card.dueDate ? getDueDateClass(card.dueDate) : '';

    const tagsHtml = card.tags && card.tags.length > 0 
        ? `<div class="tags-container">${card.tags.map(tag => `<span class="task-tag tag-${tag}">${tag}</span>`).join('')}</div>` 
        : '';

    const subtasksHtml = card.subtasks && card.subtasks.length > 0 
        ? `<div class="subtasks-container">
            <div class="subtasks-header">
                <i class="fas fa-tasks"></i> Subtasks (${card.subtasks.filter(st => st.completed).length}/${card.subtasks.length})
            </div>
            <div class="subtasks-list">
                ${card.subtasks.map(subtask => `
                    <div class="subtask-item ${subtask.completed ? 'completed' : ''}">
                        <input type="checkbox" ${subtask.completed ? 'checked' : ''} 
                               onchange="toggleSubtask('${card.id}', '${subtask.id}')">
                        <span class="subtask-text">${escapeHtml(subtask.text)}</span>
                    </div>
                `).join('')}
            </div>
        </div>` 
        : '';

    cardElement.innerHTML = `
        <div class="card-header">
            <div class="card-title">${escapeHtml(card.title)}</div>
            <div class="card-actions">
                <button class="card-action-btn" onclick="duplicateCard('${card.id}')" title="Duplicate">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="card-action-btn" onclick="editCard('${card.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="card-action-btn" onclick="deleteCardById('${card.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        ${card.description ? `<div class="card-description">${escapeHtml(card.description)}</div>` : ''}
        ${tagsHtml}
        ${subtasksHtml}
        <div class="card-footer">
            <span class="priority-badge">${card.priority}</span>
            ${dueDateText ? `<span class="due-date ${dueDateClass}">${dueDateText}</span>` : ''}
            <span>${formatDate(card.createdAt)}</span>
        </div>
    `;

    // Add drag event listeners
    cardElement.addEventListener('dragstart', drag);
    cardElement.addEventListener('dragend', dragEnd);
    cardElement.addEventListener('click', function(e) {
        if (!e.target.closest('.card-action-btn')) {
            if (isSelectionMode) {
                toggleCardSelection(card.id);
            } else {
                flipCard(cardElement);
                showCardDetail(card.id);
            }
        }
    });

    column.appendChild(cardElement);
}

function flipCard(cardElement) {
    cardElement.classList.add('flipping');
    setTimeout(() => {
        cardElement.classList.remove('flipping');
    }, 600);
}

function dragEnd() {
    document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('dragging');
    });
}

function loadCards() {
    // Clear existing cards
    document.querySelectorAll('.card-list').forEach(list => {
        list.innerHTML = '';
    });

    // Sort cards by priority: High -> Medium -> Low
    const sortedCards = [...cards].sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Render all cards in priority order
    sortedCards.forEach(card => {
        renderCard(card);
    });
}

function saveCards() {
    localStorage.setItem('bubbleBoardCards', JSON.stringify(cards));
    
    // Auto-backup with timestamp
    const backupData = {
        cards: cards,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
    
    // Keep last 5 backups
    const backups = JSON.parse(localStorage.getItem('bubbleBoardBackups') || '[]');
    backups.push(backupData);
    
    if (backups.length > 5) {
        backups.shift(); // Remove oldest backup
    }
    
    localStorage.setItem('bubbleBoardBackups', JSON.stringify(backups));
    localStorage.setItem('bubbleBoardLastBackup', new Date().toISOString());
}

// Auto-backup functionality
function createBackup() {
    const backupData = {
        cards: cards,
        timestamp: new Date().toISOString(),
        version: '1.0',
        description: 'Manual backup'
    };
    
    const backups = JSON.parse(localStorage.getItem('bubbleBoardBackups') || '[]');
    backups.push(backupData);
    
    if (backups.length > 10) {
        backups.shift();
    }
    
    localStorage.setItem('bubbleBoardBackups', JSON.stringify(backups));
    showNotification('Backup created successfully!', 'success');
}

function restoreFromBackup(backupIndex = -1) {
    const backups = JSON.parse(localStorage.getItem('bubbleBoardBackups') || '[]');
    
    if (backups.length === 0) {
        showNotification('No backups available', 'error');
        return;
    }
    
    // Use latest backup by default, or specified index
    const backupToRestore = backupIndex >= 0 ? backups[backupIndex] : backups[backups.length - 1];
    
    if (confirm(`Are you sure you want to restore from backup created on ${new Date(backupToRestore.timestamp).toLocaleString()}? This will replace all current data.`)) {
        // Save current state to undo stack
        saveToUndoStack();
        
        // Restore from backup
        cards = [...backupToRestore.cards];
        saveCards();
        loadCards();
        updateCardCounts();
        
        showNotification('Data restored from backup successfully!', 'success');
    }
}

function showBackupManager() {
    const backups = JSON.parse(localStorage.getItem('bubbleBoardBackups') || '[]');
    
    if (backups.length === 0) {
        showNotification('No backups available', 'info');
        return;
    }
    
    let backupList = 'Available Backups:\n\n';
    backups.forEach((backup, index) => {
        const date = new Date(backup.timestamp).toLocaleString();
        backupList += `${index + 1}. ${date} (${backup.cards.length} cards)\n`;
    });
    
    backupList += '\nTo restore, use: restoreFromBackup(backupIndex)';
    alert(backupList);
}

// Data Export/Import functionality
function exportData() {
    const exportData = {
        cards: cards,
        exportDate: new Date().toISOString(),
        version: '1.0',
        theme: document.getElementById('themeSelect').value
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `bubble-board-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('Data exported successfully!', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (!importData.cards || !Array.isArray(importData.cards)) {
                    showNotification('Invalid file format', 'error');
                    return;
                }
                
                if (confirm(`Import ${importData.cards.length} cards? This will replace all current data.`)) {
                    // Save current state to undo stack
                    saveToUndoStack();
                    
                    // Import data
                    cards = [...importData.cards];
                    
                    // Restore theme if available
                    if (importData.theme) {
                        document.getElementById('themeSelect').value = importData.theme;
                        changeTheme();
                    }
                    
                    saveCards();
                    loadCards();
                    updateCardCounts();
                    
                    showNotification('Data imported successfully!', 'success');
                }
            } catch (error) {
                showNotification('Error reading file: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function updateCardCounts() {
    const columns = ['todo', 'doing', 'done', 'review'];
    columns.forEach(column => {
        const count = document.getElementById(column).children.length;
        document.getElementById(`${column}-count`).textContent = count;
    });

    // Task counter was removed from HTML, so we don't need to update it
    // const taskCount = cards.length;
    // document.getElementById('taskCount').textContent = taskCount;
}

// Search functionality
function searchTasks() {
    const searchTerm = searchQuery.toLowerCase();
    const allCards = document.querySelectorAll('.card');
    
    allCards.forEach(card => {
        const title = card.querySelector('.card-title').textContent.toLowerCase();
        const description = card.querySelector('.card-description')?.textContent.toLowerCase() || '';
        
        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            card.classList.add('search-highlight');
            card.style.display = 'block';
        } else if (searchTerm === '') {
            card.classList.remove('search-highlight');
            card.style.display = 'block';
        } else {
            card.classList.remove('search-highlight');
            card.style.display = 'none';
        }
    });
}

// Drag and drop functionality
function allowDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('drag-over');
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.dataset.cardId);
    ev.target.classList.add('dragging');
}

function drop(ev) {
    ev.preventDefault();
    const cardId = ev.dataTransfer.getData("text");
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    const targetColumn = ev.target.closest('.card-list');
    
    if (targetColumn && cardElement) {
        const newColumn = targetColumn.id;
        const card = cards.find(c => c.id === cardId);
        
        if (card && card.column !== newColumn) {
            saveToUndoStack();
            card.column = newColumn;
            card.updatedAt = new Date().toISOString();
            saveCards();
            updateCardCounts();
            updateUndoRedoButtons();
        }
        
        targetColumn.appendChild(cardElement);
    }
    
    // Remove drag-over class
    document.querySelectorAll('.card-list').forEach(list => {
        list.classList.remove('drag-over');
    });
}

// Modal functions
function showAddCardModal() {
    document.getElementById('addCardModal').style.display = 'block';
    document.getElementById('cardTitle').focus();
    currentTags = [];
    updateTagsDisplay();
}

function closeModal() {
    document.getElementById('addCardModal').style.display = 'none';
    resetForm();
}

function resetForm() {
    document.getElementById('addCardForm').reset();
    document.getElementById('cardColumn').value = 'todo';
    document.getElementById('cardPriority').value = 'medium';
    document.getElementById('cardDueDate').value = '';
    document.getElementById('cardReminder').value = '';
    currentTags = [];
    updateTagsDisplay();
    
    // Reset subtasks
    window.tempSubtasks = [];
    updateSubtasksDisplay();
}

function addCard(column) {
    document.getElementById('cardColumn').value = column;
    showAddCardModal();
}

// Card detail modal
function showCardDetail(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    currentCardId = cardId;
    document.getElementById('detailCardTitle').textContent = card.title;
    document.getElementById('detailTitle').value = card.title;
    document.getElementById('detailDescription').value = card.description;
    document.getElementById('detailPriority').value = card.priority;
    document.getElementById('detailDueDate').value = card.dueDate || '';
    document.getElementById('detailReminder').value = card.reminder || '';
    
    detailTags = [...(card.tags || [])];
    updateDetailTagsDisplay();

    document.getElementById('cardDetailModal').style.display = 'block';
}

function closeDetailModal() {
    document.getElementById('cardDetailModal').style.display = 'none';
    currentCardId = null;
    detailTags = [];
}

function saveCardChanges() {
    if (!currentCardId) return;

    const card = cards.find(c => c.id === currentCardId);
    if (!card) return;

    const newTitle = document.getElementById('detailTitle').value.trim();
    const newDescription = document.getElementById('detailDescription').value.trim();
    const newPriority = document.getElementById('detailPriority').value;
    const newDueDate = document.getElementById('detailDueDate').value;
    const newReminder = document.getElementById('detailReminder').value;

    if (!newTitle) {
        alert('Please enter a title for the card');
        return;
    }

    saveToUndoStack();
    card.title = newTitle;
    card.description = newDescription;
    card.priority = newPriority;
    card.dueDate = newDueDate;
    card.reminder = newReminder;
    card.tags = [...detailTags];
    card.updatedAt = new Date().toISOString();

    saveCards();
    loadCards();
    updateCardCounts();
    setupReminder(card);
    closeDetailModal();
    updateUndoRedoButtons();
}

function deleteCard() {
    if (!currentCardId) return;

    if (confirm('Are you sure you want to delete this card?')) {
        deleteCardById(currentCardId);
        closeDetailModal();
    }
}

function deleteCardById(cardId) {
    // Clear any existing reminder for this card
    if (reminderTimeouts[cardId]) {
        clearTimeout(reminderTimeouts[cardId]);
        delete reminderTimeouts[cardId];
    }

    saveToUndoStack();
    cards = cards.filter(c => c.id !== cardId);
    saveCards();
    loadCards();
    updateCardCounts();
    updateUndoRedoButtons();
}

function editCard(cardId) {
    showCardDetail(cardId);
}

function duplicateCard(cardId) {
    const originalCard = cards.find(card => card.id === cardId);
    if (!originalCard) return;

    // Create a duplicate card
    const duplicatedCard = {
        ...originalCard,
        id: Date.now().toString(),
        title: `${originalCard.title} (Copy)`,
        createdAt: new Date().toISOString(),
        column: originalCard.column
    };

    // Add to cards array
    cards.push(duplicatedCard);
    
    // Save to undo stack
    saveToUndoStack();
    
    // Save and reload
    saveCards();
    loadCards();
    updateCardCounts();
    
    // Show success message
    showNotification('Card duplicated successfully!', 'success');
}

// Subtask management
function toggleSubtask(cardId, subtaskId) {
    const card = cards.find(c => c.id === cardId);
    if (!card || !card.subtasks) return;

    const subtask = card.subtasks.find(st => st.id === subtaskId);
    if (subtask) {
        subtask.completed = !subtask.completed;
        card.updatedAt = new Date().toISOString();
        
        saveToUndoStack();
        saveCards();
        loadCards();
        updateCardCounts();
    }
}

function addSubtask(cardId, subtaskText) {
    if (!subtaskText.trim()) return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    if (!card.subtasks) {
        card.subtasks = [];
    }

    const newSubtask = {
        id: Date.now().toString(),
        text: subtaskText.trim(),
        completed: false,
        createdAt: new Date().toISOString()
    };

    card.subtasks.push(newSubtask);
    card.updatedAt = new Date().toISOString();
    
    saveToUndoStack();
    saveCards();
    loadCards();
    updateCardCounts();
}

function removeSubtask(cardId, subtaskId) {
    const card = cards.find(c => c.id === cardId);
    if (!card || !card.subtasks) return;

    card.subtasks = card.subtasks.filter(st => st.id !== subtaskId);
    card.updatedAt = new Date().toISOString();
    
    saveToUndoStack();
    saveCards();
    loadCards();
    updateCardCounts();
}

function addSubtaskFromInput() {
    const subtaskInput = document.getElementById('subtaskInput');
    const subtaskText = subtaskInput.value.trim();
    
    if (!subtaskText) return;
    
    // Add to temporary subtasks array for the form
    if (!window.tempSubtasks) {
        window.tempSubtasks = [];
    }
    
    const newSubtask = {
        id: Date.now().toString(),
        text: subtaskText,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    window.tempSubtasks.push(newSubtask);
    updateSubtasksDisplay();
    subtaskInput.value = '';
}

function updateSubtasksDisplay() {
    const display = document.getElementById('subtasksDisplay');
    if (!display || !window.tempSubtasks) return;
    
    display.innerHTML = window.tempSubtasks.map(subtask => `
        <div class="subtask-item">
            <span class="subtask-text">${escapeHtml(subtask.text)}</span>
            <button type="button" onclick="removeTempSubtask('${subtask.id}')" class="remove-subtask-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeTempSubtask(subtaskId) {
    if (!window.tempSubtasks) return;
    
    window.tempSubtasks = window.tempSubtasks.filter(st => st.id !== subtaskId);
    updateSubtasksDisplay();
}

// Enhanced Theme management with advanced transitions
function changeTheme() {
    const theme = document.getElementById('themeSelect').value;
    const overlay = document.createElement('div');
    overlay.className = 'theme-transition-overlay';
    document.body.appendChild(overlay);
    
    // Show transition overlay with theme-specific colors
    setTimeout(() => {
        overlay.classList.add('active');
        overlay.style.background = getThemeTransitionGradient(theme);
    }, 10);
    
    // Change theme after overlay appears
    setTimeout(() => {
        document.body.className = `${theme}-theme`;
        localStorage.setItem('bubbleBoardTheme', theme);
        
        // Update theme preview
        updateThemePreview();
        
        // Recreate particles for new theme
        const particleSystem = document.querySelector('.particle-system');
        if (particleSystem) {
            createParticles(particleSystem);
        }
        
        // Hide overlay
        setTimeout(() => {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            }, 300);
        }, 200);
    }, 150);
}

function getThemeTransitionGradient(theme) {
    const gradients = {
        'light': 'linear-gradient(45deg, #f8f9fa, #e9ecef, #dee2e6)',
        'dark': 'linear-gradient(45deg, #1a1a2e, #16213e, #0f3460)',
        'reading': 'linear-gradient(45deg, #faf8f5, #f5f5f0, #f0f0eb)',
        'calm-blue': 'linear-gradient(45deg, #e3f2fd, #bbdefb, #90caf9)',
        'energetic-orange': 'linear-gradient(45deg, #fff3e0, #ffe0b2, #ffcc80)',
        'romantic-purple': 'linear-gradient(45deg, #f3e5f5, #e1bee7, #ce93d8)'
    };
    return gradients[theme] || gradients['light'];
}

function loadTheme() {
    const savedTheme = localStorage.getItem('bubbleBoardTheme') || 'light';
    document.getElementById('themeSelect').value = savedTheme;
    document.body.className = `${savedTheme}-theme`;
    updateThemePreview();
}

function updateThemePreview() {
    const preview = document.getElementById('themePreview');
    if (!preview) return;
    
    const currentTheme = document.getElementById('themeSelect').value;
    const themes = [
        { id: 'light', name: 'Light', emoji: '🌞' },
        { id: 'dark', name: 'Dark', emoji: '🌙' },
        { id: 'reading', name: 'Reading', emoji: '📖' },
        { id: 'calm-blue', name: 'Calm Blue', emoji: '🌊' },
        { id: 'energetic-orange', name: 'Energetic', emoji: '🔥' },
        { id: 'romantic-purple', name: 'Romantic', emoji: '💜' }
    ];
    
    preview.innerHTML = `
        <div class="theme-preview-grid">
            ${themes.map(theme => `
                <div class="theme-preview-item ${theme.id === currentTheme ? 'active' : ''}" 
                     onclick="selectTheme('${theme.id}')">
                    <div class="theme-preview-color ${theme.id}"></div>
                    <div class="theme-preview-name">${theme.emoji} ${theme.name}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function selectTheme(themeId) {
    document.getElementById('themeSelect').value = themeId;
    changeTheme();
}

// Selection mode and bulk actions
function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    const selectBtn = document.getElementById('selectBtn');
    
    if (isSelectionMode) {
        selectBtn.classList.add('active');
        selectBtn.title = 'Exit Selection Mode';
    } else {
        selectBtn.classList.remove('active');
        selectBtn.title = 'Select Multiple';
        clearSelection();
    }
}

function toggleCardSelection(cardId) {
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    
    if (selectedCards.has(cardId)) {
        selectedCards.delete(cardId);
        cardElement.classList.remove('selected');
    } else {
        selectedCards.add(cardId);
        cardElement.classList.add('selected');
    }
    
    updateBulkActionsBar();
}

function clearSelection() {
    selectedCards.clear();
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    updateBulkActionsBar();
}

function updateBulkActionsBar() {
    const bulkBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');
    
    selectedCount.textContent = selectedCards.size;
    
    if (selectedCards.size > 0) {
        bulkBar.classList.add('show');
    } else {
        bulkBar.classList.remove('show');
    }
}

function deleteSelectedCards() {
    if (selectedCards.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedCards.size} cards?`)) {
        saveToUndoStack();
        
        selectedCards.forEach(cardId => {
            if (reminderTimeouts[cardId]) {
                clearTimeout(reminderTimeouts[cardId]);
                delete reminderTimeouts[cardId];
            }
        });
        
        cards = cards.filter(c => !selectedCards.has(c.id));
        saveCards();
        loadCards();
        updateCardCounts();
        clearSelection();
        updateUndoRedoButtons();
    }
}

// Undo/Redo functionality
function saveToUndoStack() {
    undoStack.push(JSON.stringify(cards));
    if (undoStack.length > 20) {
        undoStack.shift();
    }
    redoStack = [];
    updateUndoRedoButtons();
}

function undoAction() {
    if (undoStack.length === 0) return;
    
    redoStack.push(JSON.stringify(cards));
    cards = JSON.parse(undoStack.pop());
    saveCards();
    loadCards();
    updateCardCounts();
    updateUndoRedoButtons();
}

function redoAction() {
    if (redoStack.length === 0) return;
    
    undoStack.push(JSON.stringify(cards));
    cards = JSON.parse(redoStack.pop());
    saveCards();
    loadCards();
    updateCardCounts();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

// Task tags functionality
function addTag(tag) {
    if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        updateTagsDisplay();
    }
}

function addDetailTag(tag) {
    if (!detailTags.includes(tag)) {
        detailTags.push(tag);
        updateDetailTagsDisplay();
    }
}

function removeTag(tag) {
    currentTags = currentTags.filter(t => t !== tag);
    updateTagsDisplay();
}

function removeDetailTag(tag) {
    detailTags = detailTags.filter(t => t !== tag);
    updateDetailTagsDisplay();
}

function updateTagsDisplay() {
    const tagsDisplay = document.getElementById('tagsDisplay');
    tagsDisplay.innerHTML = currentTags.map(tag => 
        `<span class="task-tag tag-${tag}">${tag}<span class="remove-tag" onclick="removeTag('${tag}')">&times;</span></span>`
    ).join('');
}

function updateDetailTagsDisplay() {
    const tagsDisplay = document.getElementById('detailTagsDisplay');
    tagsDisplay.innerHTML = detailTags.map(tag => 
        `<span class="task-tag tag-${tag}">${tag}<span class="remove-tag" onclick="removeDetailTag('${tag}')">&times;</span></span>`
    ).join('');
}

// PDF Export functionality
function exportToPDF() {
    // Create a new window with the board content
    const printWindow = window.open('', '_blank');
    const boardContent = document.querySelector('.kanban-board').cloneNode(true);
    
    // Remove interactive elements
    boardContent.querySelectorAll('button, .card-action-btn').forEach(el => el.remove());
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bubble Board Export</title>
            <style>
                body { font-family: 'Poppins', sans-serif; margin: 20px; }
                .kanban-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
                .column { border: 2px solid #ff69b4; border-radius: 15px; padding: 15px; }
                .column-header { border-bottom: 2px solid #ff69b4; padding-bottom: 10px; margin-bottom: 15px; }
                .card { border: 1px solid #ddd; border-radius: 10px; padding: 10px; margin-bottom: 10px; }
                .priority-badge { background: #ff69b4; color: white; padding: 2px 6px; border-radius: 5px; font-size: 0.8rem; }
                .tags-container { margin-top: 5px; }
                .task-tag { background: #ff69b4; color: white; padding: 2px 6px; border-radius: 5px; font-size: 0.7rem; margin-right: 5px; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <h1 style="color: #ff69b4; text-align: center;">Bubble Board Export</h1>
            <p style="text-align: center; color: #666;">Generated on ${new Date().toLocaleString()}</p>
            ${boardContent.outerHTML}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// Reminder functionality
function setupReminder(card) {
    if (!card.dueDate || !card.reminder) return;

    const dueDate = new Date(card.dueDate);
    const reminderMinutes = parseInt(card.reminder);
    const reminderTime = new Date(dueDate.getTime() - (reminderMinutes * 60 * 1000));
    const now = new Date();

    if (reminderTime > now) {
        const timeout = reminderTime.getTime() - now.getTime();
        reminderTimeouts[card.id] = setTimeout(() => {
            showReminder(card);
        }, timeout);
    }
}

function checkReminders() {
    const now = new Date();
    
    cards.forEach(card => {
        if (card.dueDate && card.reminder) {
            const dueDate = new Date(card.dueDate);
            const reminderMinutes = parseInt(card.reminder);
            const reminderTime = new Date(dueDate.getTime() - (reminderMinutes * 60 * 1000));
            
            // Check if reminder should be shown (within 1 minute of reminder time)
            if (Math.abs(reminderTime.getTime() - now.getTime()) < 60000) {
                showReminder(card);
            }
        }
    });
}

function showReminder(card) {
    const notification = document.getElementById('reminderNotification');
    const title = document.getElementById('reminderTitle');
    const message = document.getElementById('reminderMessage');
    
    title.textContent = card.title;
    message.textContent = `Due: ${formatDueDate(card.dueDate)}`;
    
    notification.classList.add('show');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        closeReminder();
    }, 10000);
}

function closeReminder() {
    const notification = document.getElementById('reminderNotification');
    notification.classList.remove('show');
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        return 'Today';
    } else if (diffDays === 2) {
        return 'Yesterday';
    } else if (diffDays <= 7) {
        return `${diffDays - 1} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function formatDueDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Due today';
    } else if (diffDays === 1) {
        return 'Due tomorrow';
    } else if (diffDays < 0) {
        return `Overdue by ${Math.abs(diffDays)} days`;
    } else {
        return `Due in ${diffDays} days`;
    }
}

function getDueDateClass(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return 'overdue';
    } else if (diffDays === 0) {
        return 'today';
    } else {
        return '';
    }
}

// Add some sample cards on first load
if (cards.length === 0) {
    const sampleCards = [
        {
            id: '1',
            title: 'Welcome to Bubble Board! 🫧',
            description: 'This is your new Kanban board with beautiful themes and advanced features. Try the different themes and animations!',
            priority: 'high',
            column: 'todo',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            reminder: '1440',
            tags: ['work', 'idea'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: '2',
            title: 'Try the new features',
            description: 'Test the card flip effects, rainbow trails, bulk delete, and undo/redo functionality.',
            priority: 'medium',
            column: 'doing',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            reminder: '60',
            tags: ['personal', 'urgent'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: '3',
            title: 'Explore the themes',
            description: 'Switch between Light Mode, Dark Mode, and Reading Mode to find your perfect theme.',
            priority: 'low',
            column: 'done',
            tags: ['idea'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
    
    cards = sampleCards;
    saveCards();
    loadCards();
    updateCardCounts();
    
    // Setup reminders for sample cards
    cards.forEach(card => {
        setupReminder(card);
    });
} 

// Particle System
function initializeParticleSystem() {
    const particleSystem = document.createElement('div');
    particleSystem.className = 'particle-system';
    document.body.appendChild(particleSystem);
    
    // Create particles based on theme
    createParticles(particleSystem);
    
    // Recreate particles when theme changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                setTimeout(() => createParticles(particleSystem), 500);
            }
        });
    });
    
    observer.observe(document.body, { attributes: true });
}

function createParticles(container) {
    // Clear existing particles
    container.innerHTML = '';
    
    const particleCount = 25;
    const currentTheme = document.body.className;
    
    // Different pink shades for particles
    const pinkShades = [
        'rgba(255, 20, 147, 0.8)',    // Deep pink
        'rgba(255, 105, 180, 0.7)',   // Hot pink
        'rgba(255, 107, 157, 0.7)',   // Medium pink
        'rgba(255, 153, 204, 0.6)',   // Light pink
        'rgba(255, 182, 193, 0.6)',   // Light rose
        'rgba(255, 192, 203, 0.6)',   // Pink
        'rgba(255, 130, 171, 0.6)',   // Light magenta
        'rgba(255, 99, 132, 0.7)'     // Medium rose
    ];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random positioning and sizing
        const size = Math.random() * 6 + 3; // Increased size range
        const startX = Math.random() * window.innerWidth;
        const delay = Math.random() * 8;
        const duration = Math.random() * 4 + 6;
        const pinkShade = pinkShades[Math.floor(Math.random() * pinkShades.length)];
        
        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${startX}px;
            animation-delay: ${delay}s;
            animation-duration: ${duration}s;
            background: ${pinkShade};
            border: 1px solid ${pinkShade.replace('0.8', '1').replace('0.7', '1').replace('0.6', '1')};
            box-shadow: 0 0 15px ${pinkShade};
        `;
        
        container.appendChild(particle);
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}