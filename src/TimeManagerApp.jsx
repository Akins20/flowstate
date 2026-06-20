import React, { useState, useEffect } from 'react';
import { Calendar, Clock, StickyNote, Plus, Trash, Bell } from 'lucide-react';

const TimeManagerApp = () => {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('tm-data');
    return saved ? JSON.parse(saved) : [];
  });

  const [formData, setFormData] = useState({
    title: '',
    time: '',
    date: new Date().toISOString().split('T')[0],
    type: 'task', // task or note
  });

  // Save to LocalStorage whenever items change
  useEffect(() => {
    localStorage.setItem('tm-data', JSON.stringify(items));
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, [items]);

  // Reminder Logic: Check every minute if an item is due
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentDate = now.toISOString().split('T')[0];

      items.forEach((item) => {
        if (item.date === currentDate && item.time && item.time === currentTime) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Reminder: ${item.title}`);
          }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [items]);

  const addItem = (e) => {
    e.preventDefault();
    if (!formData.title) return;
    const newItem = { ...formData, id: Date.now(), completed: false };
    setItems([newItem, ...items]);
    setFormData({ ...formData, title: '' });
  };

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-600 flex items-center gap-2">
            <Clock size={32} /> FlowState
          </h1>
          <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </header>

        {/* Input Section */}
        <form
          onSubmit={addItem}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8"
        >
          <div className="grid gap-4">
            <input
              type="text"
              placeholder="What needs to be done?"
              className="w-full text-lg border-none focus:ring-0 outline-none"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <div className="flex flex-wrap gap-4 items-center border-t pt-4">
              <div className="flex items-center gap-2 text-gray-500 bg-gray-50 p-2 rounded">
                <Calendar size={18} />
                <input
                  type="date"
                  className="bg-transparent text-sm outline-none"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 text-gray-500 bg-gray-50 p-2 rounded">
                <Clock size={18} />
                <input
                  type="time"
                  className="bg-transparent text-sm outline-none"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
              <select
                className="bg-gray-50 p-2 rounded text-sm text-gray-500 outline-none"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="task">Task/Calendar</option>
                <option value="note">Note Only</option>
              </select>
              <button
                type="submit"
                className="ml-auto bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>
        </form>

        {/* List Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Your Schedule
          </h2>
          {items.length === 0 && (
            <p className="text-gray-400 text-center py-10">
              No tasks or notes yet. Start by adding one above!
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-200 transition"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`${
                    item.type === 'task'
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-amber-100 text-amber-600'
                  } p-2 rounded-lg`}
                >
                  {item.type === 'task' ? <Bell size={20} /> : <StickyNote size={20} />}
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">{item.title}</h3>
                  <div className="flex gap-3 text-xs text-gray-400 mt-1">
                    <span>{item.date}</span>
                    {item.time && <span>• {item.time}</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                className="text-gray-300 hover:text-red-500 transition"
              >
                <Trash size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimeManagerApp;
