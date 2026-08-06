import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export const useSSE = (url: string, projectId: string) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        try {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            const eventSource = new EventSource(url + "/events?projectId=" + projectId);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                toast.success("SSE connection opened");
                console.log('SSE connection opened');
                setIsConnected(true);
                setError(null);
            };

            eventSource.onmessage = (event) => {
                try {
                    const parsedData = JSON.parse(event.data);
                    setData(parsedData);
                } catch (parseError) {
                    console.error('Error parsing SSE data:', parseError);
                    setError('Data parsing error');
                }
            };

            eventSource.onerror = (event) => {
                toast.error("SSE connection closed");
                console.error('SSE connection error:', event);
                setIsConnected(false);

                if (eventSource.readyState === EventSource.CLOSED) {
                    toast.error("SSE connection lost. Attempting to reconnect...");
                    setError('Connection lost. Attempting to reconnect...');

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, 3000);
                }
            };

        } catch (err) {
            toast.error("Error creating SSE connection");
            console.error('Error creating SSE connection:', err);
            setError('Connection creation error');
        }
    }, [url]);

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        setIsConnected(false);
    }, []);

    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        data,
        error,
        isConnected,
        connect,
        disconnect
    };
};