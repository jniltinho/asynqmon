// Command seed fills a local Redis with sample asynq tasks for developing and testing the web UI: it runs an asynq
// server, a scheduler and a producer (REDIS_ADDR, default 127.0.0.1:6379), so that
// asynqmon has data in every task state. Point it only at a throwaway Redis: it enqueues tasks and pauses the
// "reports" queue.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hibiken/asynq"
)

func main() {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6379"
	}
	r := asynq.RedisClientOpt{Addr: addr}
	c := asynq.NewClient(r)
	defer c.Close()

	srv := asynq.NewServer(r, asynq.Config{
		Concurrency:      6,
		Queues:           map[string]int{"critical": 6, "default": 3, "emails": 2, "low": 1, "reports": 1},
		GroupGracePeriod: 10 * time.Minute,
		GroupMaxDelay:    30 * time.Minute,
		GroupMaxSize:     500,
		GroupAggregator: asynq.GroupAggregatorFunc(func(group string, tasks []*asynq.Task) *asynq.Task {
			return asynq.NewTask("notification:digest", []byte(fmt.Sprintf(`{"group":%q,"count":%d}`, group, len(tasks))))
		}),
		RetryDelayFunc: func(n int, e error, t *asynq.Task) time.Duration { return time.Duration(10+n*60) * time.Minute },
		LogLevel:       asynq.WarnLevel,
	})
	mux := asynq.NewServeMux()
	mux.HandleFunc("email:send", func(ctx context.Context, t *asynq.Task) error {
		time.Sleep(time.Duration(200+rand.Intn(800)) * time.Millisecond)
		if rand.Intn(8) == 0 {
			return errors.New("smtp: 451 4.7.1 temporary failure, try again later")
		}
		return nil
	})
	mux.HandleFunc("image:resize", func(ctx context.Context, t *asynq.Task) error {
		select {
		case <-time.After(time.Duration(30+rand.Intn(90)) * time.Second):
		case <-ctx.Done():
			return ctx.Err()
		}
		return nil
	})
	mux.HandleFunc("report:generate", func(ctx context.Context, t *asynq.Task) error {
		return errors.New("report: upstream warehouse timed out after 30s")
	})
	mux.HandleFunc("webhook:deliver", func(ctx context.Context, t *asynq.Task) error {
		_, err := t.ResultWriter().Write([]byte(fmt.Sprintf(`{"status":200,"latency_ms":%d}`, 20+rand.Intn(300))))
		return err
	})
	mux.HandleFunc("notification:digest", func(ctx context.Context, t *asynq.Task) error { return nil })
	// Start, not Run: Run handles the signals itself; here one context stops the producer, then both services.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := srv.Start(mux); err != nil {
		log.Fatal(err)
	}
	defer srv.Shutdown()

	sch := asynq.NewScheduler(r, nil)
	sch.Register("@every 30s", asynq.NewTask("email:send", js(map[string]interface{}{"to": "digest@example.com", "template": "daily"})), asynq.Queue("emails"))
	sch.Register("0 * * * *", asynq.NewTask("report:generate", js(map[string]interface{}{"report": "hourly-sales"})), asynq.Queue("reports"), asynq.MaxRetry(1))
	sch.Register("*/5 * * * *", asynq.NewTask("webhook:deliver", js(map[string]interface{}{"url": "https://hooks.example.com/ping"})), asynq.Retention(24*time.Hour))
	if err := sch.Start(); err != nil {
		log.Fatal(err)
	}
	defer sch.Shutdown()

	insp := asynq.NewInspector(r)
	insp.PauseQueue("reports")

	enq := func(t *asynq.Task, opts ...asynq.Option) {
		if _, err := c.Enqueue(t, opts...); err != nil {
			log.Println(err)
		}
	}
	users := []string{"ana", "bruno", "carla", "diego", "elisa", "fabio"}
	for i := 0; i < 120; i++ {
		enq(asynq.NewTask("report:generate", js(map[string]interface{}{"report": "monthly", "customer_id": 1000 + i, "format": "pdf"})), asynq.Queue("reports"))
		enq(asynq.NewTask("email:send", js(map[string]interface{}{"to": users[i%6] + "@example.com", "subject": "Welcome", "user_id": i})), asynq.Queue("emails"), asynq.ProcessIn(time.Duration(1+i)*time.Hour))
		enq(asynq.NewTask("image:resize", js(map[string]interface{}{"src": fmt.Sprintf("s3://media/img-%04d.jpg", i), "sizes": []int{64, 256, 1024}})), asynq.Queue("low"))
	}
	for i := 0; i < 30; i++ {
		enq(asynq.NewTask("report:generate", js(map[string]interface{}{"report": "audit", "id": i})), asynq.Queue("critical"), asynq.MaxRetry(3))
		enq(asynq.NewTask("report:generate", js(map[string]interface{}{"report": "legacy", "id": i})), asynq.Queue("default"), asynq.MaxRetry(0))
		enq(asynq.NewTask("notification:push", js(map[string]interface{}{"user": users[i%6], "text": "New message"})), asynq.Queue("default"), asynq.Group("user:"+users[i%3]))
	}
	for ctx.Err() == nil {
		enq(asynq.NewTask("email:send", js(map[string]interface{}{"to": users[rand.Intn(6)] + "@example.com", "subject": "Receipt"})), asynq.Queue("emails"))
		enq(asynq.NewTask("webhook:deliver", js(map[string]interface{}{"url": "https://hooks.example.com/orders", "order": rand.Intn(99999)})), asynq.Queue("critical"), asynq.Retention(24*time.Hour))
		if rand.Intn(4) == 0 {
			enq(asynq.NewTask("image:resize", js(map[string]interface{}{"src": "s3://media/upload.png"})), asynq.Queue("default"), asynq.Timeout(5*time.Minute))
		}
		select {
		case <-ctx.Done():
		case <-time.After(2 * time.Second):
		}
	}
}

func js(v interface{}) []byte { b, _ := json.Marshal(v); return b }
