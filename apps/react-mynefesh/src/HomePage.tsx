import React, { useState, useEffect } from 'react';

const HomePage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Fetch data from the API route when the component mounts
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/getData'); // Make sure this URL is correct
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const responseData = await response.json();
      setData(responseData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div>
      <h1>Data from API</h1>
      <ul>
        {data.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default HomePage;
